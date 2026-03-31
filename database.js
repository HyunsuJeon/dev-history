const Database = require('better-sqlite3');
const db = new Database('devhistory.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    image_path TEXT,
    tags TEXT,
    date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

try {
  db.exec(`ALTER TABLE records ADD COLUMN tags TEXT`);
} catch(e) {}

module.exports = db;