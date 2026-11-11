jest.mock('../../server/push', () => ({ sendPushToPlayer: jest.fn() }));

const WebSocket = require('ws');
const { sendPushToPlayer } = require('../../server/push');
const { initDB, pool } = require('../../server/db');
const { server } = require('../../server/app');
const { createActiveRoom } = require('../helpers');

let serverInstance;
let port;

// Start server on dynamic port for each test file
beforeAll(async () => {
  await initDB();
  return new Promise((resolve) => {
    serverInstance = server.listen(0, () => {
      port = serverInstance.address().port;
      resolve();
    });
  });
});

afterAll(() => {
  serverInstance.close();
  return pool.end();
});

// connectWs attaches a single persistent message listener immediately, buffering every
// message into a queue. Without this, a message that arrives between the socket opening
// and a later `nextMessage()` call (which is common with two simultaneous clients) would
// be silently dropped, since EventEmitter doesn't replay events to late-attached listeners.
function connectWs(roomId, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws?room=${roomId}${token ? `&token=${token}` : ''}`);
    ws._messageQueue = [];
    ws._messageWaiters = [];
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      const idx = ws._messageWaiters.findIndex(w => w.type === msg.type);
      if (idx !== -1) {
        const [waiter] = ws._messageWaiters.splice(idx, 1);
        clearTimeout(waiter.timeout);
        waiter.resolve(msg);
      } else {
        ws._messageQueue.push(msg);
      }
    });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function nextMessage(ws, type, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const idx = ws._messageQueue.findIndex(m => m.type === type);
    if (idx !== -1) {
      const [msg] = ws._messageQueue.splice(idx, 1);
      resolve(msg);
      return;
    }
    const timeout = setTimeout(() => {
      const i = ws._messageWaiters.findIndex(w => w.type === type);
      if (i !== -1) ws._messageWaiters.splice(i, 1);
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeoutMs);
    ws._messageWaiters.push({ type, resolve, timeout });
  });
}

describe('WebSocket API', () => {
  const kingsAndRooks = () => [
    [null,null,null,null,'bK',null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ['wR',null,null,null,'wK',null,null,'wR'],
  ];

  describe('Connection', () => {
    test('Tokens decide the color', async () => {
      const room = await createActiveRoom();
      const white = await connectWs(room.id, room.whiteToken);
      const black = await connectWs(room.id, room.blackToken);
      const spectator = await connectWs(room.id);

      const w = await nextMessage(white, 'connected');
      expect(w.color).toBe('white');
      expect(w.roomStatus).toBe('active');
      expect((await nextMessage(black, 'connected')).color).toBe('black');
      expect((await nextMessage(spectator, 'connected')).color).toBe('spectator');
      [white, black, spectator].forEach(ws => ws.close());
    });

    test('A wrong token is treated as a spectator', async () => {
      const room = await createActiveRoom();
      const ws = await connectWs(room.id, 'not-a-real-token');
      expect((await nextMessage(ws, 'connected')).color).toBe('spectator');
      ws.close();
    });

    test('Unknown room closes the connection', async () => {
      const ws = new WebSocket(`ws://localhost:${port}/ws?room=00000000-0000-0000-0000-000000000000`);
      const code = await new Promise((resolve) => ws.on('close', resolve));
      expect(code).toBe(4004);
    });

    test('Other players are told when someone joins', async () => {
      const room = await createActiveRoom();
      const white = await connectWs(room.id, room.whiteToken);
      await nextMessage(white, 'connected');
      const black = await connectWs(room.id, room.blackToken);
      const joined = await nextMessage(white, 'player_joined');
      expect(joined.color).toBe('black');
      white.close();
      black.close();
    });
  });

  describe('Move Flow', () => {
    test('Valid move broadcasts to both players', async () => {
      const room = await createActiveRoom();
      const wsWhite = await connectWs(room.id, room.whiteToken);
      const wsBlack = await connectWs(room.id, room.blackToken);
      await nextMessage(wsWhite, 'connected');
      await nextMessage(wsBlack, 'connected');

      wsWhite.send(JSON.stringify({ type: 'move', from: 'e2', to: 'e4', piece: 'wP' }));

      const whiteMove = await nextMessage(wsWhite, 'move');
      const blackMove = await nextMessage(wsBlack, 'move');
      expect(whiteMove.from).toBe('e2');
      expect(blackMove.to).toBe('e4');
      expect(blackMove.nextTurn).toBe('black');
      wsWhite.close();
      wsBlack.close();
    });

    test('Invalid move sends error', async () => {
      const room = await createActiveRoom();
      const wsWhite = await connectWs(room.id, room.whiteToken);
      await nextMessage(wsWhite, 'connected');
      wsWhite.send(JSON.stringify({ type: 'move', from: 'e2', to: 'e5', piece: 'wP' }));
      const error = await nextMessage(wsWhite, 'error');
      expect(error.message).toBeDefined();
      wsWhite.close();
    });

    test('Illegal move doesn\'t reach the opponent or change the board', async () => {
      const room = await createActiveRoom();
      const wsWhite = await connectWs(room.id, room.whiteToken);
      const wsBlack = await connectWs(room.id, room.blackToken);
      await nextMessage(wsWhite, 'connected');
      await nextMessage(wsBlack, 'connected');

      wsWhite.send(JSON.stringify({ type: 'move', from: 'e2', to: 'e5', piece: 'wP' }));
      await nextMessage(wsWhite, 'error');
      await expect(nextMessage(wsBlack, 'move', 400)).rejects.toThrow('Timeout');

      const row = await pool.query('SELECT current_turn FROM rooms WHERE id = $1', [room.id]);
      expect(row.rows[0].current_turn).toBe('white');
      wsWhite.close();
      wsBlack.close();
    });

    test('Cannot move when not your turn', async () => {
      const room = await createActiveRoom();
      const wsBlack = await connectWs(room.id, room.blackToken);
      await nextMessage(wsBlack, 'connected');
      wsBlack.send(JSON.stringify({ type: 'move', from: 'e7', to: 'e5', piece: 'bP' }));
      const error = await nextMessage(wsBlack, 'error');
      expect(error.message).toContain('Not your turn');
      wsBlack.close();
    });

    test('Spectators cannot move', async () => {
      const room = await createActiveRoom();
      const spectator = await connectWs(room.id);
      await nextMessage(spectator, 'connected');
      spectator.send(JSON.stringify({ type: 'move', from: 'e2', to: 'e4', piece: 'wP' }));
      const error = await nextMessage(spectator, 'error');
      expect(error.message).toContain('Spectators');
      spectator.close();
    });

    test('Checkmate ends the game and records the winner', async () => {
      // Back-rank mate: white rook a1 -> a8 against a boxed-in black king on h8
      const board = [
        [null,null,null,null,null,null,null,'bK'],
        [null,null,null,null,null,null,'bP','bP'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['wR',null,null,null,'wK',null,null,null],
      ];
      const room = await createActiveRoom({ board });
      const wsWhite = await connectWs(room.id, room.whiteToken);
      await nextMessage(wsWhite, 'connected');
      wsWhite.send(JSON.stringify({ type: 'move', from: 'a1', to: 'a8', piece: 'wR' }));

      const over = await nextMessage(wsWhite, 'game_over');
      expect(over.status).toBe('checkmate');
      expect(over.winnerColor).toBe('white');
      const row = await pool.query('SELECT status, winner FROM rooms WHERE id = $1', [room.id]);
      expect(row.rows[0]).toEqual({ status: 'finished', winner: 'white' });
      wsWhite.close();
    });
  });

  describe('Game Events', () => {
    test('Resign triggers game_over for everyone', async () => {
      const room = await createActiveRoom();
      const wsWhite = await connectWs(room.id, room.whiteToken);
      const wsBlack = await connectWs(room.id, room.blackToken);
      await nextMessage(wsWhite, 'connected');
      await nextMessage(wsBlack, 'connected');

      wsWhite.send(JSON.stringify({ type: 'resign' }));

      const whiteOver = await nextMessage(wsWhite, 'game_over');
      const blackOver = await nextMessage(wsBlack, 'game_over');
      expect(whiteOver.winnerColor).toBe('black');
      expect(blackOver.resignedBy).toBe('white');
      wsWhite.close();
      wsBlack.close();
    });

    test('Spectators cannot resign or accept a draw', async () => {
      const room = await createActiveRoom();
      const spectator = await connectWs(room.id);
      await nextMessage(spectator, 'connected');
      spectator.send(JSON.stringify({ type: 'resign' }));
      spectator.send(JSON.stringify({ type: 'accept_draw' }));
      await new Promise(r => setTimeout(r, 300));
      const row = await pool.query('SELECT status FROM rooms WHERE id = $1', [room.id]);
      expect(row.rows[0].status).toBe('active');
      spectator.close();
    });

    test('Disconnect triggers player_left', async () => {
      const room = await createActiveRoom();
      const wsWhite = await connectWs(room.id, room.whiteToken);
      const wsBlack = await connectWs(room.id, room.blackToken);
      await nextMessage(wsWhite, 'connected');
      await nextMessage(wsBlack, 'connected');
      wsWhite.close();
      const left = await nextMessage(wsBlack, 'player_left');
      expect(left.color).toBe('white');
      wsBlack.close();
    });

    test('Draw offers reach the other player', async () => {
      const room = await createActiveRoom();
      const wsWhite = await connectWs(room.id, room.whiteToken);
      const wsBlack = await connectWs(room.id, room.blackToken);
      await nextMessage(wsWhite, 'connected');
      await nextMessage(wsBlack, 'connected');
      wsWhite.send(JSON.stringify({ type: 'offer_draw' }));
      expect((await nextMessage(wsBlack, 'draw_offered')).from).toBe('white');
      wsWhite.close();
      wsBlack.close();
    });
  });

  describe('Push notifications', () => {
    beforeEach(() => sendPushToPlayer.mockClear());

    test('Move pushes to the opponent only', async () => {
      const room = await createActiveRoom();
      const wsWhite = await connectWs(room.id, room.whiteToken);
      await nextMessage(wsWhite, 'connected');
      wsWhite.send(JSON.stringify({ type: 'move', from: 'e2', to: 'e4', piece: 'wP' }));
      await nextMessage(wsWhite, 'move');

      expect(sendPushToPlayer).toHaveBeenCalledTimes(1);
      const [roomId, color, payload] = sendPushToPlayer.mock.calls[0];
      expect(roomId).toBe(room.id);
      expect(color).toBe('black');
      expect(payload).toEqual({ title: 'White moved', body: 'e4', url: `/game/${room.id}` });
      wsWhite.close();
    });

    test('Resign pushes to the winner', async () => {
      const room = await createActiveRoom();
      const wsWhite = await connectWs(room.id, room.whiteToken);
      await nextMessage(wsWhite, 'connected');
      wsWhite.send(JSON.stringify({ type: 'resign' }));
      await nextMessage(wsWhite, 'game_over');
      expect(sendPushToPlayer).toHaveBeenCalledWith(room.id, 'black', expect.objectContaining({ title: 'Game over' }));
      wsWhite.close();
    });

    test('Accepted draw pushes to the other player', async () => {
      const room = await createActiveRoom();
      const wsBlack = await connectWs(room.id, room.blackToken);
      await nextMessage(wsBlack, 'connected');
      wsBlack.send(JSON.stringify({ type: 'accept_draw' }));
      await nextMessage(wsBlack, 'game_over');
      expect(sendPushToPlayer).toHaveBeenCalledWith(room.id, 'white', expect.objectContaining({ title: 'Game over' }));
      wsBlack.close();
    });

    test('Spectator moves send no push', async () => {
      const room = await createActiveRoom();
      const spectator = await connectWs(room.id);
      await nextMessage(spectator, 'connected');
      spectator.send(JSON.stringify({ type: 'move', from: 'e2', to: 'e4', piece: 'wP' }));
      await nextMessage(spectator, 'error');
      expect(sendPushToPlayer).not.toHaveBeenCalled();
      spectator.close();
    });
  });

  describe('Castling', () => {
    test('Kingside castle move is broadcast and persisted', async () => {
      const room = await createActiveRoom({ board: kingsAndRooks() });
      const wsWhite = await connectWs(room.id, room.whiteToken);
      const wsBlack = await connectWs(room.id, room.blackToken);
      await nextMessage(wsWhite, 'connected');
      await nextMessage(wsBlack, 'connected');

      wsWhite.send(JSON.stringify({ type: 'move', from: 'e1', to: 'g1', piece: 'wK' }));

      const whiteMove = await nextMessage(wsWhite, 'move');
      const blackMove = await nextMessage(wsBlack, 'move');
      expect(whiteMove.isCastle).toBe('kingside');
      expect(whiteMove.notation).toBe('O-O');
      expect(blackMove.isCastle).toBe('kingside');

      const row = await pool.query('SELECT white_king_moved FROM rooms WHERE id = $1', [room.id]);
      expect(row.rows[0].white_king_moved).toBe(true);
      wsWhite.close();
      wsBlack.close();
    });

    test('Castling rejected when king has already moved', async () => {
      const room = await createActiveRoom({ board: kingsAndRooks(), castlingRights: { whiteKingMoved: true } });
      const wsWhite = await connectWs(room.id, room.whiteToken);
      await nextMessage(wsWhite, 'connected');
      wsWhite.send(JSON.stringify({ type: 'move', from: 'e1', to: 'g1', piece: 'wK' }));
      await nextMessage(wsWhite, 'error');

      const row = await pool.query('SELECT * FROM rooms WHERE id = $1', [room.id]);
      expect(row.rows[0].current_turn).toBe('white');
      expect(JSON.parse(row.rows[0].board_state)[7][4]).toBe('wK');
      wsWhite.close();
    });
  });
});
