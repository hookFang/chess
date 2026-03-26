const bcrypt = require('bcrypt');
const { pool } = require('../server/db');
const { signToken } = require('../server/auth');
const { boardToFen, INITIAL_BOARD } = require('../server/chess');

async function createUser(username, password) {
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
    [username.toLowerCase(), passwordHash]
  );
  const user = result.rows[0];
  const token = signToken({ id: user.id, username: user.username });
  return { user, token };
}

async function createRoom(whiteUserId, status = 'waiting') {
  const boardState = boardToFen(INITIAL_BOARD);
  const result = await pool.query(
    `INSERT INTO rooms (white_player_id, status, board_state, current_turn)
     VALUES ($1, $2, $3, 'white')
     RETURNING id, status`,
    [whiteUserId, status, boardState]
  );
  return result.rows[0];
}

async function createActiveRoom(whiteUserId, blackUserId) {
  const boardState = boardToFen(INITIAL_BOARD);
  const result = await pool.query(
    `INSERT INTO rooms (white_player_id, black_player_id, status, board_state, current_turn)
     VALUES ($1, $2, 'active', $3, 'white')
     RETURNING id, status`,
    [whiteUserId, blackUserId, boardState]
  );
  return result.rows[0];
}

module.exports = { createUser, createRoom, createActiveRoom };
