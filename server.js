require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, init } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'devhistory_secret_key';

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

// ===== 미들웨어 =====
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: '로그인이 필요해요' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: '토큰이 유효하지 않아요' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: '관리자만 접근 가능해요' });
  next();
}

// ===== 관리자 초기 생성 / 동기화 =====
async function createAdminIfNotExists() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';
  const hash = await bcrypt.hash(adminPassword, 10);
  const existing = await pool.query('SELECT id FROM users WHERE role = $1', ['admin']);
  if (existing.rows.length === 0) {
    await pool.query(
      'INSERT INTO users (username, password_hash, role, status) VALUES ($1, $2, $3, $4)',
      [adminUsername, hash, 'admin', 'approved']
    );
    console.log(`관리자 계정 생성: ${adminUsername}`);
  } else {
    // 환경변수가 명시적으로 설정된 경우 항상 최신 비밀번호로 업데이트
    await pool.query(
      'UPDATE users SET username = $1, password_hash = $2 WHERE role = $3',
      [adminUsername, hash, 'admin']
    );
    console.log(`관리자 계정 동기화: ${adminUsername}`);
  }
}

// ===== 인증 API =====
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: '아이디와 비밀번호를 입력해주세요' });
  const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows.length > 0) return res.status(400).json({ message: '이미 존재하는 아이디예요' });
  const hash = await bcrypt.hash(password, 10);
  await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, hash]);
  res.json({ message: '가입 신청이 완료됐어요! 관리자 승인 후 로그인 가능해요' });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ message: '아이디 또는 비밀번호가 틀려요' });
  if (user.status === 'pending') return res.status(403).json({ message: '관리자 승인 대기 중이에요' });
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ message: '아이디 또는 비밀번호가 틀려요' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username, role: user.role });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

// ===== 관리자 API =====
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const result = await pool.query('SELECT id, username, role, status, created_at FROM users ORDER BY status ASC, created_at DESC');
  res.json(result.rows);
});

app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { status } = req.body;
  await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, req.params.id]);
  res.json({ message: '변경됐어요' });
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ message: '삭제됐어요' });
});

// ===== 히스토리 API =====
app.get('/api/records', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM records ORDER BY date DESC');
  res.json(result.rows);
});

app.post('/api/records', requireAuth, upload.single('image'), async (req, res) => {
  const { type, title, description, date, tags } = req.body;
  const image_path = req.file ? '/uploads/' + req.file.filename : null;
  const result = await pool.query(
    'INSERT INTO records (type, title, description, image_path, tags, date, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [type, title, description, image_path, tags, date, req.user.username]
  );
  res.json({ id: result.rows[0].id, message: '저장됐어요!' });
});

app.delete('/api/records/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM records WHERE id = $1', [req.params.id]);
  res.json({ message: '삭제됐어요!' });
});

// ===== 할 일 API =====
app.get('/api/tasks', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
  res.json(result.rows);
});

app.post('/api/tasks', requireAuth, upload.single('image'), async (req, res) => {
  const { title, type, description, tags, priority, start_date, deadline } = req.body;
  const image_path = req.file ? '/uploads/' + req.file.filename : null;
  const result = await pool.query(
    'INSERT INTO tasks (title, type, description, tags, priority, status, start_date, deadline, image_path, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
    [title, type, description, tags, priority || '보통', '대기', start_date, deadline, image_path, req.user.username]
  );
  res.json({ id: result.rows[0].id, message: '추가됐어요!' });
});

app.patch('/api/tasks/:id', requireAuth, async (req, res) => {
  const { status } = req.body;
  await pool.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, req.params.id]);
  res.json({ message: '상태 변경됐어요!' });
});

app.post('/api/tasks/:id/complete', requireAuth, upload.single('image'), async (req, res) => {
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
    'INSERT INTO records (type, title, description, image_path, tags, date, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [task.type, task.title, description, image_path, task.tags, date, req.user.username]
  );
  res.json({ id: result.rows[0].id, message: '완료 처리됐어요!' });
});

app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  res.json({ message: '삭제됐어요!' });
});

// 서버 시작
init().then(async () => {
  await createAdminIfNotExists();
  app.listen(PORT, () => console.log(`서버 실행 중! http://localhost:${PORT}`));
});
