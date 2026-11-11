const crypto = require('crypto');
const { pool } = require('../server/db');
const { boardToFen, INITIAL_BOARD } = require('../server/chess');

// An active room with both seats taken. Options let a test start from a custom
// position (raw 8x8 board), castling flags, or side to move.
async function createActiveRoom({ board = INITIAL_BOARD, castlingRights = {}, currentTurn = 'white' } = {}) {
  const whiteToken = crypto.randomUUID();
  const blackToken = crypto.randomUUID();
  const r = castlingRights;
  const result = await pool.query(
    `INSERT INTO rooms (
       white_token, black_token, status, board_state, current_turn,
       white_king_moved, black_king_moved, white_rook_a_moved, white_rook_h_moved,
       black_rook_a_moved, black_rook_h_moved
     )
     VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, status`,
    [
      whiteToken, blackToken, boardToFen(board), currentTurn,
      !!r.whiteKingMoved, !!r.blackKingMoved, !!r.whiteRookAMoved, !!r.whiteRookHMoved,
      !!r.blackRookAMoved, !!r.blackRookHMoved,
    ]
  );
  return { ...result.rows[0], whiteToken, blackToken };
}

module.exports = { createActiveRoom };
