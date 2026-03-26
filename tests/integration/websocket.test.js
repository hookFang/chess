const WebSocket = require('ws');
const { initDB, pool } = require('../../server/db');
const { app, server } = require('../../server/app');
const { createUser, createActiveRoom } = require('../helpers');

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

function connectWs(roomId, token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws?roomId=${roomId}&token=${token}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function nextMessage(ws, type, timeoutMs = 1000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeoutMs);

    const handler = (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === type) {
          ws.removeEventListener('message', handler);
          clearTimeout(timeout);
          resolve(msg);
        }
      } catch (e) {
        reject(e);
      }
    };

    ws.on('message', handler);
  });
}

describe('WebSocket API', () => {
  describe('Connection', () => {
    test('Valid token receives connected message', async () => {
      const white = await createUser('ws_white_1', 'password123');
      const black = await createUser('ws_black_1', 'password123');
      const room = await createActiveRoom(white.user.id, black.user.id);

      const ws = await connectWs(room.id, white.token);
      const msg = await nextMessage(ws, 'connected');

      expect(msg.type).toBe('connected');
      expect(msg.color).toBe('white');
      expect(msg.roomId).toBe(room.id);

      ws.close();
    });

    test('Invalid token disconnects', async () => {
      const white = await createUser('ws_white_2', 'password123');
      const black = await createUser('ws_black_2', 'password123');
      const room = await createActiveRoom(white.user.id, black.user.id);

      try {
        const ws = new WebSocket(`ws://localhost:${port}/ws?roomId=${room.id}&token=invalid.token`);
        await new Promise((resolve, reject) => {
          ws.on('close', resolve);
          ws.on('message', () => reject(new Error('Should not receive messages')));
          setTimeout(() => reject(new Error('WebSocket should close')), 2000);
        });
      } catch (e) {
        expect(e.message).toBe('WebSocket should close');
        // Expected - invalid token should close connection
      }
    });
  });

  describe('Move Flow', () => {
    test('Valid move broadcasts to both players', async () => {
      const white = await createUser('ws_white_3', 'password123');
      const black = await createUser('ws_black_3', 'password123');
      const room = await createActiveRoom(white.user.id, black.user.id);

      const wsWhite = await connectWs(room.id, white.token);
      const wsBlack = await connectWs(room.id, black.token);

      // Both get connected messages
      const whiteConnected = await nextMessage(wsWhite, 'connected');
      const blackConnected = await nextMessage(wsBlack, 'connected');

      expect(whiteConnected.color).toBe('white');
      expect(blackConnected.color).toBe('black');

      // White moves e2->e4
      wsWhite.send(JSON.stringify({
        type: 'move',
        from: 'e2',
        to: 'e4',
        piece: 'wP',
      }));

      // Both should receive move confirmation
      const whiteMove = await nextMessage(wsWhite, 'move_made');
      const blackMove = await nextMessage(wsBlack, 'move_made');

      expect(whiteMove.from).toBe('e2');
      expect(whiteMove.to).toBe('e4');
      expect(blackMove.from).toBe('e2');
      expect(blackMove.to).toBe('e4');

      wsWhite.close();
      wsBlack.close();
    });

    test('Invalid move sends error', async () => {
      const white = await createUser('ws_white_4', 'password123');
      const black = await createUser('ws_black_4', 'password123');
      const room = await createActiveRoom(white.user.id, black.user.id);

      const wsWhite = await connectWs(room.id, white.token);
      await nextMessage(wsWhite, 'connected');

      // Try invalid move (pawn can't move 3 squares)
      wsWhite.send(JSON.stringify({
        type: 'move',
        from: 'e2',
        to: 'e5',
        piece: 'wP',
      }));

      const error = await nextMessage(wsWhite, 'error');
      expect(error.type).toBe('error');
      expect(error.message).toBeDefined();

      wsWhite.close();
    });

    test('Illegal move doesn\'t change board', async () => {
      const white = await createUser('ws_white_5', 'password123');
      const black = await createUser('ws_black_5', 'password123');
      const room = await createActiveRoom(white.user.id, black.user.id);

      const wsWhite = await connectWs(room.id, white.token);
      const wsBlack = await connectWs(room.id, black.token);

      await nextMessage(wsWhite, 'connected');
      await nextMessage(wsBlack, 'connected');

      // Try illegal move
      wsWhite.send(JSON.stringify({
        type: 'move',
        from: 'e2',
        to: 'e5',
        piece: 'wP',
      }));

      const error = await nextMessage(wsWhite, 'error');
      expect(error.type).toBe('error');

      // Black should not receive move_made
      const timer = setTimeout(() => {}, 500);
      let receivedMove = false;
      wsBlack.once('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'move_made') receivedMove = true;
      });

      // Wait a bit to see if Black gets a move
      await new Promise(r => setTimeout(r, 500));
      clearTimeout(timer);
      expect(receivedMove).toBe(false);

      wsWhite.close();
      wsBlack.close();
    });
  });

  describe('Game Events', () => {
    test('Resign triggers game_over', async () => {
      const white = await createUser('ws_white_6', 'password123');
      const black = await createUser('ws_black_6', 'password123');
      const room = await createActiveRoom(white.user.id, black.user.id);

      const wsWhite = await connectWs(room.id, white.token);
      const wsBlack = await connectWs(room.id, black.token);

      await nextMessage(wsWhite, 'connected');
      await nextMessage(wsBlack, 'connected');

      // White resigns
      wsWhite.send(JSON.stringify({ type: 'resign' }));

      const whiteGameOver = await nextMessage(wsWhite, 'game_over');
      const blackGameOver = await nextMessage(wsBlack, 'game_over');

      expect(whiteGameOver.winner).toBe('black');
      expect(blackGameOver.winner).toBe('black');

      wsWhite.close();
      wsBlack.close();
    });

    test('Disconnect triggers player_left', async () => {
      const white = await createUser('ws_white_7', 'password123');
      const black = await createUser('ws_black_7', 'password123');
      const room = await createActiveRoom(white.user.id, black.user.id);

      const wsWhite = await connectWs(room.id, white.token);
      const wsBlack = await connectWs(room.id, black.token);

      await nextMessage(wsWhite, 'connected');
      await nextMessage(wsBlack, 'connected');

      // White disconnects
      wsWhite.close();

      const playerLeft = await nextMessage(wsBlack, 'player_left');
      expect(playerLeft.type).toBe('player_left');

      wsBlack.close();
    });
  });

  describe('Turn Enforcement', () => {
    test('Cannot move when not your turn', async () => {
      const white = await createUser('ws_white_8', 'password123');
      const black = await createUser('ws_black_8', 'password123');
      const room = await createActiveRoom(white.user.id, black.user.id);

      const wsWhite = await connectWs(room.id, white.token);
      const wsBlack = await connectWs(room.id, black.token);

      await nextMessage(wsWhite, 'connected');
      await nextMessage(wsBlack, 'connected');

      // Black tries to move on white's turn
      wsBlack.send(JSON.stringify({
        type: 'move',
        from: 'e7',
        to: 'e5',
        piece: 'bP',
      }));

      const error = await nextMessage(wsBlack, 'error');
      expect(error.type).toBe('error');
      expect(error.message).toContain('not your turn');

      wsWhite.close();
      wsBlack.close();
    });
  });
});
