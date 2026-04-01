const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS records (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      image_path TEXT,
      tags TEXT,
      date TEXT NOT NULL,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      priority TEXT DEFAULT '보통',
      status TEXT DEFAULT '대기',
      start_date TEXT,
      deadline TEXT,
      image_path TEXT,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    )
  `);
  // 기존 테이블에 누락된 컬럼 자동 추가 (마이그레이션)
  const migrations = [
    `ALTER TABLE records ADD COLUMN IF NOT EXISTS created_by TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by TEXT`,
    `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP`,
  ];
  for (const sql of migrations) {
    await pool.query(sql).catch(() => {});
  }
  console.log('DB 테이블 준비 완료');
}

module.exports = { pool, init };
