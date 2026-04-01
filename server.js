require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool, init } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

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
app.get('/api/records', async (req, res) => {
  const result = await pool.query('SELECT * FROM records ORDER BY date DESC');
  res.json(result.rows);
});

app.post('/api/records', upload.single('image'), async (req, res) => {
  const { type, title, description, date, tags } = req.body;
  const image_path = req.file ? '/uploads/' + req.file.filename : null;
  const result = await pool.query(
    'INSERT INTO records (type, title, description, image_path, tags, date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [type, title, description, image_path, tags, date]
  );
  res.json({ id: result.rows[0].id, message: '저장됐어요!' });
});

app.delete('/api/records/:id', async (req, res) => {
  await pool.query('DELETE FROM records WHERE id = $1', [req.params.id]);
  res.json({ message: '삭제됐어요!' });
});

// ===== 할 일 =====
app.get('/api/tasks', async (req, res) => {
  const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
  res.json(result.rows);
});

app.post('/api/tasks', upload.single('image'), async (req, res) => {
  const { title, type, description, tags, priority, start_date, deadline } = req.body;
  const image_path = req.file ? '/uploads/' + req.file.filename : null;
  const result = await pool.query(
    'INSERT INTO tasks (title, type, description, tags, priority, status, start_date, deadline, image_path) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
    [title, type, description, tags, priority || '보통', '대기', start_date, deadline, image_path]
  );
  res.json({ id: result.rows[0].id, message: '추가됐어요!' });
});

app.patch('/api/tasks/:id', async (req, res) => {
  const { status } = req.body;
  await pool.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, req.params.id]);
  res.json({ message: '상태 변경됐어요!' });
});

app.post('/api/tasks/:id/complete', upload.single('image'), async (req, res) => {
  const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  const task = taskResult.rows[0];
  if (!task) return res.status(404).json({ message: '없는 항목이에요' });

  const completedAt = new Date().toISOString().slice(0, 10);
  await pool.query('UPDATE tasks SET status = $1, completed_at = $2 WHERE id = $3', ['완료', completedAt, req.params.id]);

  const image_path = req.file ? '/uploads/' + req.file.filename : task.image_path;
  const { note } = req.body;
  const description = note
    ? (task.description ? task.description + '\n\n[완료 메모]\n' + note : note)
    : task.description;
  const date = task.start_date ? task.start_date + ' ~ ' + completedAt : completedAt;

  const result = await pool.query(
    'INSERT INTO records (type, title, description, image_path, tags, date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [task.type, task.title, description, image_path, task.tags, date]
  );
  res.json({ id: result.rows[0].id, message: '완료 처리됐어요!' });
});

app.delete('/api/tasks/:id', async (req, res) => {
  await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  res.json({ message: '삭제됐어요!' });
});

// 서버 시작
init().then(() => {
  app.listen(PORT, () => console.log(`서버 실행 중! http://localhost:${PORT}`));
});
