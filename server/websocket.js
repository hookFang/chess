const { WebSocketServer } = require('ws');
const { URL } = require('url');
const { pool } = require('./db');
const { wsAuth } = require('./auth');
const { applyMove } = require('./chess');

// In-memory map: roomId -> Set<clientInfo>
// clientInfo = { ws, userId, username, color }
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
    let roomId, userId, username, color;

    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      roomId = url.searchParams.get('room');

      if (!token || !roomId) {
        ws.close(4001, 'Missing token or room');
        return;
      }

      const payload = wsAuth(token);
      if (!payload) {
        ws.close(4001, 'Invalid token');
        return;
      }

      userId = payload.id;
      username = payload.username;

      // Look up room to determine color
      const roomResult = await pool.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
      if (!roomResult.rows[0]) {
        ws.close(4004, 'Room not found');
        return;
      }
      const room = roomResult.rows[0];

      if (room.white_player_id === userId) color = 'white';
      else if (room.black_player_id === userId) color = 'black';
      else color = 'spectator';

      const clientInfo = { ws, userId, username, color };
      getRoomClients(roomId).add(clientInfo);

      sendTo(ws, {
        type: 'connected',
        userId,
        username,
        color,
        roomStatus: room.status,
      });

      // Notify others
      const players = getPlayersInfo(roomId);
      broadcast(roomId, { type: 'player_joined', username, color, players }, ws);

      ws.on('message', async (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'ping') {
          sendTo(ws, { type: 'pong' });
          return;
        }

        if (msg.type === 'move') {
          await handleMove(ws, roomId, userId, username, color, msg);
        } else if (msg.type === 'resign') {
          await handleResign(ws, roomId, userId, username, color);
        } else if (msg.type === 'offer_draw') {
          broadcast(roomId, { type: 'draw_offered', from: username }, ws);
        } else if (msg.type === 'accept_draw') {
          await handleAcceptDraw(roomId);
        }
      });

      ws.on('close', () => {
        const clients = rooms.get(roomId);
        if (clients) {
          clients.delete(clientInfo);
          if (clients.size === 0) {
            rooms.delete(roomId);
          } else {
            broadcast(roomId, { type: 'player_left', username, color });
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
  return [...clients].map(c => ({ username: c.username, color: c.color }));
}

async function handleMove(ws, roomId, userId, username, color, msg) {
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

    const result = applyMove(room.board_state, msg.from, msg.to, msg.promotion);
    if (!result.valid) {
      await client.query('ROLLBACK');
      sendTo(ws, { type: 'error', message: result.error || 'Illegal move' });
      return;
    }

    // Count moves for move number
    const moveCountResult = await client.query(
      'SELECT COUNT(*) FROM moves WHERE room_id = $1',
      [roomId]
    );
    const moveNumber = parseInt(moveCountResult.rows[0].count) + 1;

    // Save move
    await client.query(
      `INSERT INTO moves (room_id, player_id, from_square, to_square, piece, captured, promotion, move_notation, board_state, move_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [roomId, userId, msg.from, msg.to, msg.piece, result.captured, result.promotion, result.notation, result.newBoard, moveNumber]
    );

    // Determine next turn and room status
    const nextTurn = color === 'white' ? 'black' : 'white';
    let newStatus = 'active';
    let winnerId = null;

    if (result.gameStatus === 'checkmate') {
      newStatus = 'finished';
      winnerId = result.winnerId === 'white' ? room.white_player_id : room.black_player_id;
    } else if (result.gameStatus === 'stalemate') {
      newStatus = 'finished';
    }

    await client.query(
      `UPDATE rooms SET board_state = $1, current_turn = $2, status = $3, winner_id = $4, updated_at = NOW()
       WHERE id = $5`,
      [result.newBoard, nextTurn, newStatus, winnerId, roomId]
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
      winnerId,
    });

    if (newStatus === 'finished') {
      broadcastAll(roomId, {
        type: 'game_over',
        status: result.gameStatus,
        winnerId,
        winnerColor: result.winnerId || null,
      });
    }

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('handleMove error:', err);
    sendTo(ws, { type: 'error', message: 'Server error processing move' });
  } finally {
    client.release();
  }
}

async function handleResign(ws, roomId, userId, username, color) {
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

    const winnerId = color === 'white' ? room.black_player_id : room.white_player_id;
    await client.query(
      `UPDATE rooms SET status = 'finished', winner_id = $1, updated_at = NOW() WHERE id = $2`,
      [winnerId, roomId]
    );
    await client.query('COMMIT');

    broadcastAll(roomId, {
      type: 'game_over',
      status: 'resignation',
      winnerId,
      winnerColor: color === 'white' ? 'black' : 'white',
      resignedBy: username,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('handleResign error:', err);
  } finally {
    client.release();
  }
}

async function handleAcceptDraw(roomId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE rooms SET status = 'finished', winner_id = NULL, updated_at = NOW() WHERE id = $1`,
      [roomId]
    );
    await client.query('COMMIT');

    broadcastAll(roomId, {
      type: 'game_over',
      status: 'draw',
      winnerId: null,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('handleAcceptDraw error:', err);
  } finally {
    client.release();
  }
}

module.exports = { setupWebSocket };
