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

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ===== 히스토리 =====
app.get('/api/records', (req, res) => {
  res.json(db.prepare('SELECT * FROM records ORDER BY date DESC').all());
});

app.post('/api/records', upload.single('image'), (req, res) => {
  const { type, title, description, date, tags } = req.body;
  const image_path = req.file ? '/uploads/' + req.file.filename : null;
  const result = db.prepare(
    'INSERT INTO records (type, title, description, image_path, tags, date) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(type, title, description, image_path, tags, date);
  res.json({ id: result.lastInsertRowid, message: '저장됐어요!' });
});

app.delete('/api/records/:id', (req, res) => {
  db.prepare('DELETE FROM records WHERE id = ?').run(req.params.id);
  res.json({ message: '삭제됐어요!' });
});

// ===== 할 일 =====
app.get('/api/tasks', (req, res) => {
  res.json(db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all());
});

app.post('/api/tasks', upload.single('image'), (req, res) => {
  const { title, type, description, tags, priority, start_date, deadline } = req.body;
  const image_path = req.file ? '/uploads/' + req.file.filename : null;
  const result = db.prepare(
    'INSERT INTO tasks (title, type, description, tags, priority, status, start_date, deadline, image_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(title, type, description, tags, priority || '보통', '대기', start_date, deadline, image_path);
  res.json({ id: result.lastInsertRowid, message: '추가됐어요!' });
});

app.patch('/api/tasks/:id', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ message: '상태 변경됐어요!' });
});

app.post('/api/tasks/:id/complete', upload.single('image'), (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ message: '없는 항목이에요' });

  const completedAt = new Date().toISOString().slice(0, 10);
  db.prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?').run('완료', completedAt, req.params.id);

  const image_path = req.file ? '/uploads/' + req.file.filename : task.image_path;
  const { note } = req.body;
  const description = note
    ? (task.description ? task.description + '\n\n[완료 메모]\n' + note : note)
    : task.description;
  const date = task.start_date ? task.start_date + ' ~ ' + completedAt : completedAt;

  const result = db.prepare(
    'INSERT INTO records (type, title, description, image_path, tags, date) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(task.type, task.title, description, image_path, task.tags, date);
  res.json({ id: result.lastInsertRowid, message: '완료 처리됐어요!' });
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: '삭제됐어요!' });
});

app.listen(PORT, () => console.log(`서버 실행 중! http://localhost:${PORT}`));
