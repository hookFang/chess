process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || 5432;
process.env.DB_NAME = process.env.DB_NAME || 'chessdb_test';
process.env.DB_USER = process.env.DB_USER || 'chess';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'chesspass';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

const { initDB, pool } = require('../server/db');

beforeAll(async () => {
  await initDB();
});

beforeEach(async () => {
  // Truncate tables in reverse dependency order
  await pool.query('TRUNCATE TABLE moves RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE TABLE rooms RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
});

// Do not call pool.end() here — the pool is shared across all test files
// in the same process (runInBand) and ending it would break subsequent files.
