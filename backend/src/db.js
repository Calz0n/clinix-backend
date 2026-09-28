const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'clinix_db',
  user: process.env.DB_USER || 'clinix_user',
  password: process.env.DB_PASSWORD || 'clinix_secure_password_2026',
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
