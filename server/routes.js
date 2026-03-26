const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('./db');
const { signToken, authMiddleware } = require('./auth');
const { boardToFen, INITIAL_BOARD } = require('./chess');

const router = express.Router();

// POST /api/auth/register
router.post('/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: 'Username must be 3-50 characters' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const lowerUsername = username.toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [lowerUsername, passwordHash]
    );

    const user = result.rows[0];
    const token = signToken({ id: user.id, username: user.username });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already taken' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const lowerUsername = username.toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [lowerUsername]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: user.id, username: user.username });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/auth/me', authMiddleware, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username } });
});

// GET /api/rooms — list rooms the user has participated in
router.get('/rooms', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.status, r.current_turn, r.created_at, r.updated_at,
        wu.username AS white_username, wu.id AS white_id,
        bu.username AS black_username, bu.id AS black_id,
        win.username AS winner_username
       FROM rooms r
       LEFT JOIN users wu ON wu.id = r.white_player_id
       LEFT JOIN users bu ON bu.id = r.black_player_id
       LEFT JOIN users win ON win.id = r.winner_id
       WHERE r.white_player_id = $1 OR r.black_player_id = $1
       ORDER BY r.updated_at DESC
       LIMIT 20`,
      [req.user.id]
    );

    const rooms = result.rows.map(r => {
      const myColor = r.white_id === req.user.id ? 'white' : 'black';
      const opponent = myColor === 'white'
        ? (r.black_id ? { id: r.black_id, username: r.black_username } : null)
        : (r.white_id ? { id: r.white_id, username: r.white_username } : null);
      return {
        id: r.id,
        status: r.status,
        currentTurn: r.current_turn,
        myColor,
        opponent,
        winner: r.winner_username || null,
        updatedAt: r.updated_at,
      };
    });

    res.json({ rooms });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rooms
router.post('/rooms', authMiddleware, async (req, res) => {
  try {
    const boardState = boardToFen(INITIAL_BOARD);
    const result = await pool.query(
      `INSERT INTO rooms (white_player_id, status, board_state, current_turn)
       VALUES ($1, 'waiting', $2, 'white')
       RETURNING id, status`,
      [req.user.id, boardState]
    );
    const room = result.rows[0];
    res.json({ roomId: room.id, joinUrl: `/game/${room.id}`, status: room.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/rooms/:id
router.get('/rooms/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*,
        wu.username AS white_username,
        bu.username AS black_username,
        wu.id AS white_id,
        bu.id AS black_id,
        win.username AS winner_username,
        win.id AS winner_id_ref
       FROM rooms r
       LEFT JOIN users wu ON wu.id = r.white_player_id
       LEFT JOIN users bu ON bu.id = r.black_player_id
       LEFT JOIN users win ON win.id = r.winner_id
       WHERE r.id = $1`,
      [req.params.id]
    );

    if (!result.rows[0]) return res.status(404).json({ error: 'Room not found' });
    const room = result.rows[0];

    const movesResult = await pool.query(
      `SELECT from_square AS "from", to_square AS "to", piece, captured, move_notation AS notation, move_number
       FROM moves WHERE room_id = $1 ORDER BY move_number ASC`,
      [req.params.id]
    );

    let myColor = null;
    if (room.white_player_id === req.user.id) myColor = 'white';
    else if (room.black_player_id === req.user.id) myColor = 'black';

    res.json({
      id: room.id,
      status: room.status,
      currentTurn: room.current_turn,
      boardState: room.board_state,
      whitePlayer: room.white_id ? { id: room.white_id, username: room.white_username } : null,
      blackPlayer: room.black_id ? { id: room.black_id, username: room.black_username } : null,
      winner: room.winner_id ? { id: room.winner_id, username: room.winner_username } : null,
      myColor,
      moves: movesResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/rooms/:id/join
router.post('/rooms/:id/join', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rooms WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Room not found' });
    const room = result.rows[0];

    // Already in room
    if (room.white_player_id === req.user.id) {
      return res.json({ color: 'white', status: room.status });
    }
    if (room.black_player_id === req.user.id) {
      return res.json({ color: 'black', status: room.status });
    }

    // Assign as black if slot open
    if (!room.black_player_id) {
      await pool.query(
        `UPDATE rooms SET black_player_id = $1, status = 'active', updated_at = NOW() WHERE id = $2`,
        [req.user.id, req.params.id]
      );
      return res.json({ color: 'black', status: 'active' });
    }

    return res.status(400).json({ error: 'Room is full' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
