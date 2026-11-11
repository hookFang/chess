const crypto = require('crypto');
const express = require('express');
const { pool } = require('./db');
const { boardToFen, INITIAL_BOARD } = require('./chess');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function newToken() {
  return crypto.randomUUID();
}

// Which side does this token belong to? 'white' | 'black' | null (spectator)
function colorForToken(room, token) {
  if (!token) return null;
  if (room.white_token && room.white_token === token) return 'white';
  if (room.black_token && room.black_token === token) return 'black';
  return null;
}

function castlingRightsOf(room) {
  return {
    whiteKingMoved: room.white_king_moved,
    blackKingMoved: room.black_king_moved,
    whiteRookAMoved: room.white_rook_a_moved,
    whiteRookHMoved: room.white_rook_h_moved,
    blackRookAMoved: room.black_rook_a_moved,
    blackRookHMoved: room.black_rook_h_moved,
  };
}

async function findRoom(id) {
  if (!UUID_RE.test(id)) return null;
  const result = await pool.query('SELECT * FROM rooms WHERE id = $1', [id]);
  return result.rows[0] || null;
}

const playerToken = (req) => req.get('x-player-token') || null;

// POST /api/rooms — create a game. Body { color: 'white' | 'black' | 'random' } (default random)
// picks the creator's side; the person who opens the link gets the other one.
router.post('/rooms', async (req, res) => {
  try {
    const choice = (req.body || {}).color || 'random';
    if (!['white', 'black', 'random'].includes(choice)) {
      return res.status(400).json({ error: 'color must be white, black or random' });
    }
    const color = choice === 'random' ? (crypto.randomInt(2) === 0 ? 'white' : 'black') : choice;
    const token = newToken();
    const result = await pool.query(
      `INSERT INTO rooms (white_token, black_token, status, board_state, current_turn)
       VALUES ($1, $2, 'waiting', $3, 'white')
       RETURNING id, status`,
      [color === 'white' ? token : null, color === 'black' ? token : null, boardToFen(INITIAL_BOARD)]
    );
    const room = result.rows[0];
    res.json({ roomId: room.id, joinUrl: `/game/${room.id}`, status: room.status, color, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rooms/:id
router.get('/rooms/:id', async (req, res) => {
  try {
    const room = await findRoom(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const movesResult = await pool.query(
      `SELECT from_square AS "from", to_square AS "to", piece, captured, move_notation AS notation, move_number
       FROM moves WHERE room_id = $1 ORDER BY move_number ASC`,
      [room.id]
    );

    res.json({
      id: room.id,
      status: room.status,
      currentTurn: room.current_turn,
      boardState: room.board_state,
      whiteJoined: !!room.white_token,
      blackJoined: !!room.black_token,
      winner: room.winner,
      myColor: colorForToken(room, playerToken(req)),
      moves: movesResult.rows,
      castlingRights: castlingRightsOf(room),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rooms/:id/join — take the open seat, or resume with an existing token.
// Anyone arriving after both seats are taken is a spectator (no token).
router.post('/rooms/:id/join', async (req, res) => {
  try {
    const room = await findRoom(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const existing = colorForToken(room, playerToken(req));
    if (existing) return res.json({ color: existing, status: room.status });

    const openColor = !room.white_token ? 'white' : !room.black_token ? 'black' : null;
    if (openColor) {
      const token = newToken();
      // The IS NULL condition makes sure only one visitor can win the seat.
      const claimed = await pool.query(
        `UPDATE rooms SET ${openColor}_token = $1, status = 'active', updated_at = NOW()
         WHERE id = $2 AND ${openColor}_token IS NULL RETURNING id`,
        [token, room.id]
      );
      if (claimed.rowCount > 0) return res.json({ color: openColor, status: 'active', token });
    }

    res.json({ color: 'spectator', status: room.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/push/vapid-public-key (public)
router.get('/push/vapid-public-key', (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) return res.status(503).json({ error: 'Push not configured' });
  res.json({ publicKey });
});

// POST /api/rooms/:id/push — subscribe this player (identified by their room token)
router.post('/rooms/:id/push', async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  try {
    const room = await findRoom(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const color = colorForToken(room, playerToken(req));
    if (!color) return res.status(403).json({ error: 'Only players can subscribe' });

    await pool.query(
      `INSERT INTO push_subscriptions (room_id, color, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (room_id, endpoint) DO UPDATE
       SET color = EXCLUDED.color, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [room.id, color, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
