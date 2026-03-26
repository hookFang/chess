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
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        white_player_id UUID REFERENCES users(id),
        black_player_id UUID REFERENCES users(id),
        status VARCHAR(20) NOT NULL DEFAULT 'waiting',
        board_state TEXT NOT NULL DEFAULT 'start',
        current_turn VARCHAR(5) NOT NULL DEFAULT 'white',
        winner_id UUID REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS moves (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        player_id UUID NOT NULL REFERENCES users(id),
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

    await client.query(`CREATE INDEX IF NOT EXISTS idx_moves_room_id ON moves(room_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status)`);

    console.log('Database initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
