const { WebSocketServer } = require('ws');
const { URL } = require('url');
const { pool } = require('./db');
const { applyMove } = require('./chess');
const { sendPushToPlayer } = require('./push');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const other = (color) => (color === 'white' ? 'black' : 'white');
const cap = (color) => color.charAt(0).toUpperCase() + color.slice(1);

function roomCastlingRights(room) {
  return {
    whiteKingMoved: room.white_king_moved,
    blackKingMoved: room.black_king_moved,
    whiteRookAMoved: room.white_rook_a_moved,
    whiteRookHMoved: room.white_rook_h_moved,
    blackRookAMoved: room.black_rook_a_moved,
    blackRookHMoved: room.black_rook_h_moved,
  };
}

// In-memory map: roomId -> Set<clientInfo>
// clientInfo = { ws, color }  (color: 'white' | 'black' | 'spectator')
const rooms = new Map();

function getRoomClients(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  return rooms.get(roomId);
}

function broadcast(roomId, data, excludeWs = null) {
  const clients = rooms.get(roomId);
  if (!clients) return;
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.ws !== excludeWs && client.ws.readyState === 1) {
      client.ws.send(msg);
    }
  }
}

function broadcastAll(roomId, data) {
  broadcast(roomId, data, null);
}

function sendTo(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    let roomId, color;

    try {
      const url = new URL(req.url, 'http://localhost');
      roomId = url.searchParams.get('room');
      const token = url.searchParams.get('token'); // optional: absent for spectators

      if (!roomId || !UUID_RE.test(roomId)) {
        ws.close(4004, 'Room not found');
        return;
      }

      const roomResult = await pool.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
      if (!roomResult.rows[0]) {
        ws.close(4004, 'Room not found');
        return;
      }
      const room = roomResult.rows[0];

      if (token && room.white_token === token) color = 'white';
      else if (token && room.black_token === token) color = 'black';
      else color = 'spectator';

      const clientInfo = { ws, color };
      getRoomClients(roomId).add(clientInfo);

      sendTo(ws, {
        type: 'connected',
        color,
        roomStatus: room.status,
        castlingRights: roomCastlingRights(room),
      });

      broadcast(roomId, { type: 'player_joined', color, players: getPlayersInfo(roomId) }, ws);

      ws.on('message', async (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'ping') {
          sendTo(ws, { type: 'pong' });
          return;
        }

        if (msg.type === 'move') {
          await handleMove(ws, roomId, color, msg);
        } else if (msg.type === 'resign') {
          await handleResign(roomId, color);
        } else if (msg.type === 'offer_draw') {
          if (color !== 'spectator') broadcast(roomId, { type: 'draw_offered', from: color }, ws);
        } else if (msg.type === 'accept_draw') {
          await handleAcceptDraw(roomId, color);
        }
      });

      ws.on('close', () => {
        const clients = rooms.get(roomId);
        if (clients) {
          clients.delete(clientInfo);
          if (clients.size === 0) {
            rooms.delete(roomId);
          } else {
            broadcast(roomId, { type: 'player_left', color });
          }
        }
      });

    } catch (err) {
      console.error('WebSocket connection error:', err);
      ws.close(1011, 'Internal error');
    }
  });
}

function getPlayersInfo(roomId) {
  const clients = rooms.get(roomId);
  if (!clients) return [];
  return [...clients].map(c => ({ color: c.color }));
}

async function handleMove(ws, roomId, color, msg) {
  if (color === 'spectator') {
    sendTo(ws, { type: 'error', message: 'Spectators cannot move' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const roomResult = await client.query(
      'SELECT * FROM rooms WHERE id = $1 FOR UPDATE',
      [roomId]
    );
    const room = roomResult.rows[0];
    if (!room) {
      await client.query('ROLLBACK');
      sendTo(ws, { type: 'error', message: 'Room not found' });
      return;
    }

    if (room.status !== 'active') {
      await client.query('ROLLBACK');
      sendTo(ws, { type: 'error', message: 'Game is not active' });
      return;
    }

    if (room.current_turn !== color) {
      await client.query('ROLLBACK');
      sendTo(ws, { type: 'error', message: 'Not your turn' });
      return;
    }

    const result = applyMove(room.board_state, msg.from, msg.to, msg.promotion, roomCastlingRights(room));
    if (!result.valid) {
      await client.query('ROLLBACK');
      sendTo(ws, { type: 'error', message: result.error || 'Illegal move' });
      return;
    }

    const moveCountResult = await client.query(
      'SELECT COUNT(*) FROM moves WHERE room_id = $1',
      [roomId]
    );
    const moveNumber = parseInt(moveCountResult.rows[0].count) + 1;

    await client.query(
      `INSERT INTO moves (room_id, from_square, to_square, piece, captured, promotion, move_notation, board_state, move_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [roomId, msg.from, msg.to, msg.piece, result.captured, result.promotion, result.notation, result.newBoard, moveNumber]
    );

    const nextTurn = other(color);
    let newStatus = 'active';
    let winner = null;

    if (result.gameStatus === 'checkmate') {
      newStatus = 'finished';
      winner = result.winnerId; // engine returns 'white' | 'black'
    } else if (result.gameStatus === 'stalemate') {
      newStatus = 'finished';
    }

    const rights = result.newCastlingRights;

    await client.query(
      `UPDATE rooms SET board_state = $1, current_turn = $2, status = $3, winner = $4, updated_at = NOW(),
              white_king_moved = $5, black_king_moved = $6,
              white_rook_a_moved = $7, white_rook_h_moved = $8,
              black_rook_a_moved = $9, black_rook_h_moved = $10
       WHERE id = $11`,
      [result.newBoard, nextTurn, newStatus, winner,
       rights.whiteKingMoved, rights.blackKingMoved,
       rights.whiteRookAMoved, rights.whiteRookHMoved,
       rights.blackRookAMoved, rights.blackRookHMoved,
       roomId]
    );

    await client.query('COMMIT');

    broadcastAll(roomId, {
      type: 'move',
      from: msg.from,
      to: msg.to,
      piece: msg.piece,
      captured: result.captured,
      promotion: result.promotion,
      notation: result.notation,
      moveNumber,
      boardState: result.newBoard,
      nextTurn,
      gameStatus: result.gameStatus,
      inCheck: result.inCheck,
      winnerColor: winner,
      isCastle: result.isCastle,
      castlingRights: rights,
    });

    if (newStatus === 'finished') {
      broadcastAll(roomId, {
        type: 'game_over',
        status: result.gameStatus,
        winnerColor: winner,
      });
    }

    // Web push to the opponent (fire-and-forget, regardless of live WS connection)
    const url = `/game/${roomId}`;
    if (newStatus === 'finished') {
      const body = result.gameStatus === 'checkmate'
        ? `${cap(color)} checkmated you (${result.notation})`
        : `Game drawn by stalemate (${result.notation})`;
      sendPushToPlayer(roomId, nextTurn, { title: 'Game over', body, url });
    } else {
      sendPushToPlayer(roomId, nextTurn, { title: `${cap(color)} moved`, body: result.notation, url });
    }

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('handleMove error:', err);
    sendTo(ws, { type: 'error', message: 'Server error processing move' });
  } finally {
    client.release();
  }
}

async function handleResign(roomId, color) {
  if (color === 'spectator') return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roomResult = await client.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [roomId]);
    const room = roomResult.rows[0];
    if (!room || room.status !== 'active') {
      await client.query('ROLLBACK');
      return;
    }

    const winner = other(color);
    await client.query(
      `UPDATE rooms SET status = 'finished', winner = $1, updated_at = NOW() WHERE id = $2`,
      [winner, roomId]
    );
    await client.query('COMMIT');

    broadcastAll(roomId, {
      type: 'game_over',
      status: 'resignation',
      winnerColor: winner,
      resignedBy: color,
    });

    sendPushToPlayer(roomId, winner, { title: 'Game over', body: `${cap(color)} resigned. You win!`, url: `/game/${roomId}` });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('handleResign error:', err);
  } finally {
    client.release();
  }
}

async function handleAcceptDraw(roomId, color) {
  if (color === 'spectator') return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE rooms SET status = 'finished', winner = NULL, updated_at = NOW()
       WHERE id = $1 AND status = 'active' RETURNING id`,
      [roomId]
    );
    await client.query('COMMIT');
    if (updated.rowCount === 0) return;

    broadcastAll(roomId, {
      type: 'game_over',
      status: 'draw',
      winnerColor: null,
    });

    sendPushToPlayer(roomId, other(color), { title: 'Game over', body: `${cap(color)} accepted the draw`, url: `/game/${roomId}` });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('handleAcceptDraw error:', err);
  } finally {
    client.release();
  }
}

module.exports = { setupWebSocket };
