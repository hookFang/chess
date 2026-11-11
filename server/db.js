const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'chessdb',
  user: process.env.DB_USER || 'chess',
  password: process.env.DB_PASSWORD || 'chesspass',
});

async function initDB() {
  const client = await pool.connect();
  try {
    // One-time upgrade from the old account-based schema. Old games were tied to
    // user accounts and cannot be joined anonymously, so they are discarded.
    const legacy = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'rooms' AND column_name = 'white_player_id'`
    );
    if (legacy.rowCount > 0) {
      await client.query('DROP TABLE IF EXISTS push_subscriptions');
      await client.query('DROP TABLE IF EXISTS moves');
      await client.query('DROP TABLE IF EXISTS rooms');
      await client.query('DROP TABLE IF EXISTS users CASCADE');
    }

    // Players are anonymous: each side of a room is identified only by a secret
    // token that the browser keeps in localStorage.
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        white_token TEXT,
        black_token TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'waiting',
        board_state TEXT NOT NULL DEFAULT 'start',
        current_turn VARCHAR(5) NOT NULL DEFAULT 'white',
        winner VARCHAR(5),
        white_king_moved BOOLEAN NOT NULL DEFAULT FALSE,
        black_king_moved BOOLEAN NOT NULL DEFAULT FALSE,
        white_rook_a_moved BOOLEAN NOT NULL DEFAULT FALSE,
        white_rook_h_moved BOOLEAN NOT NULL DEFAULT FALSE,
        black_rook_a_moved BOOLEAN NOT NULL DEFAULT FALSE,
        black_rook_h_moved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS moves (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        from_square VARCHAR(3) NOT NULL,
        to_square VARCHAR(3) NOT NULL,
        piece VARCHAR(3) NOT NULL,
        captured VARCHAR(3),
        promotion VARCHAR(3),
        move_notation VARCHAR(20),
        board_state TEXT NOT NULL,
        move_number INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // One browser can follow several games, so a subscription is unique per (room, endpoint).
    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        color VARCHAR(5) NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (room_id, endpoint)
      )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_moves_room_id ON moves(room_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_room_id ON push_subscriptions(room_id)`);

    console.log('Database initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
