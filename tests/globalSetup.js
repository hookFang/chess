const { Pool } = require('pg');

module.exports = async function globalSetup() {
  const adminPool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: 'postgres',
    user: process.env.DB_USER || 'chess',
    password: process.env.DB_PASSWORD || 'chesspass',
  });

  try {
    await adminPool.query('CREATE DATABASE chessdb_test');
  } catch (e) {
    // Ignore if already exists
  } finally {
    await adminPool.end();
  }
};
