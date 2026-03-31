const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 전체 기록 조회
app.get('/api/records', (req, res) => {
  const records = db.prepare('SELECT * FROM records ORDER BY date DESC').all();
  res.json(records);
});

// 기록 추가
app.post('/api/records', upload.single('image'), (req, res) => {
  const { type, title, description, date } = req.body;
  const image_path = req.file ? '/uploads/' + req.file.filename : null;
  const stmt = db.prepare(
    'INSERT INTO records (type, title, description, image_path, date) VALUES (?, ?, ?, ?, ?)'
  );
  const result = stmt.run(type, title, description, image_path, date);
  res.json({ id: result.lastInsertRowid, message: '저장됐어요!' });
});

// 기록 삭제
app.delete('/api/records/:id', (req, res) => {
  db.prepare('DELETE FROM records WHERE id = ?').run(req.params.id);
  res.json({ message: '삭제됐어요!' });
});

app.listen(PORT, () => {
  console.log(`서버 실행 중! http://localhost:${PORT}`);
});