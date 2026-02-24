const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Your Supabase Nano tier allows 15 connections; 
  // setting max to 10 keeps your app stable.
  max: 10, 
  connectionTimeoutMillis: 10000,
});

const initializeDatabase = async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('📦 PostgreSQL firmly connected via Transaction Pooler.');

    // This ensures the registration table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        clinic_name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'BCBA',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    console.error('❌ Database Initialization Error:', err.message);
  }
};

initializeDatabase();

module.exports = pool;