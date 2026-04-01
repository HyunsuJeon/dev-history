let allRecords = [];
let allTasks = [];
let currentTab = 'tasks';
let completingTaskId = null;
let taskFilter = '전체';
let completedVisible = true;

async function init() {
  await Promise.all([loadRecords(), loadTasks()]);
  onTypeChange();
}

// ===== 탭 =====
function switchTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('section-tasks').style.display = tab === 'tasks' ? '' : 'none';
  document.getElementById('section-history').style.display = tab === 'history' ? '' : 'none';
  updateStats();
}

// ===== 통계 =====
function updateStats() {
  const area = document.getElementById('stats-area');
  if (currentTab === 'tasks') {
    const total = allTasks.length;
    const waiting = allTasks.filter(t => t.status === '대기').length;
    const inprog = allTasks.filter(t => t.status === '진행중').length;
    const done = allTasks.filter(t => t.status === '완료').length;
    area.innerHTML = `
      <div class="stat clickable" onclick="filterByTaskStat('전체', this)"><div class="stat-n">${total}</div><div class="stat-l">전체</div></div>
      <div class="stat clickable" onclick="filterByTaskStat('대기', this)"><div class="stat-n" style="color:var(--accent)">${waiting}</div><div class="stat-l">대기</div></div>
      <div class="stat clickable" onclick="filterByTaskStat('진행중', this)"><div class="stat-n" style="color:var(--blue)">${inprog}</div><div class="stat-l">진행중</div></div>
      <div class="stat clickable" onclick="filterByTaskStat('완료', this)"><div class="stat-n" style="color:var(--green)">${done}</div><div class="stat-l">완료</div></div>
    `;
  } else {
    const total = allRecords.length;
    const feat = allRecords.filter(r => r.type === '기능개발').length;
    const bug = allRecords.filter(r => r.type === '버그수정').length;
    const cs = allRecords.filter(r => r.type === 'CS응대').length;
    const inc = allRecords.filter(r => r.type === '장애내역').length;
    area.innerHTML = `
      <div class="stat clickable" onclick="filterHistoryStat('전체', this)"><div class="stat-n">${total}</div><div class="stat-l">전체</div></div>
      <div class="stat clickable" onclick="filterHistoryStat('기능개발', this)"><div class="stat-n feat">${feat}</div><div class="stat-l">기능</div></div>
      <div class="stat clickable" onclick="filterHistoryStat('버그수정', this)"><div class="stat-n bug">${bug}</div><div class="stat-l">버그</div></div>
      <div class="stat clickable" onclick="filterHistoryStat('CS응대', this)"><div class="stat-n cs">${cs}</div><div class="stat-l">CS</div></div>
      <div class="stat clickable" onclick="filterHistoryStat('장애내역', this)"><div class="stat-n incident">${inc}</div><div class="stat-l">장애</div></div>
    `;
  }
}

function filterHistoryStat(type, el) {
  document.querySelectorAll('#stats-area .stat').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  renderRecords(type === '전체' ? allRecords : allRecords.filter(r => r.type === type));
}

// ===== 할 일 =====
async function loadTasks() {
  const res = await fetch('/api/tasks');
  allTasks = await res.json();
  renderTasks();
  updateStats();
}

function renderTasks() {
  let filtered;
  if (taskFilter === '전체') {
    filtered = allTasks;
  } else if (taskFilter === '완료') {
    filtered = allTasks.filter(t => t.status === '완료');
  } else {
    filtered = allTasks.filter(t => t.status === taskFilter);
  }

  document.getElementById('tasks-list').innerHTML = filtered.length === 0
    ? '<div class="empty">해당 항목이 없어요</div>'
    : filtered.map(t => taskCard(t, t.status === '완료')).join('');
}

function taskCard(t, isCompleted = false) {
  const priorityClass = { '긴급': 'priority-urgent', '보통': 'priority-normal', '낮음': 'priority-low' }[t.priority] || '';
  const tags = t.tags ? t.tags.split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('') : '';
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = t.deadline && t.deadline < today && !isCompleted;
  const deadlineText = t.deadline ? `<span class="deadline${isOverdue ? ' overdue' : ''}">~ ${t.deadline}</span>` : '';

  let actionBtns = '';
  if (!isCompleted) {
    if (t.status === '대기') {
      actionBtns = `<button class="status-btn start" onclick="updateTaskStatus(${t.id}, '진행중')">시작</button>`;
    } else {
      actionBtns = `
        <button class="status-btn pause" onclick="updateTaskStatus(${t.id}, '대기')">대기로</button>
        <button class="status-btn complete" onclick="openCompleteModal(${t.id})">완료</button>
      `;
    }
  }
  actionBtns += `<button class="del-btn" onclick="deleteTask(${t.id})">삭제</button>`;

  return `
    <div class="record-card type-${t.type}">
      <div class="card-top">
        <span class="badge badge-${t.type}">${t.type}</span>
        <span class="priority-badge ${priorityClass}">${t.priority}</span>
        <span class="card-title">${t.title}</span>
        ${deadlineText}
      </div>
      ${t.description ? `<div class="card-desc">${t.description}</div>` : ''}
      ${t.image_path ? `<img class="card-image" src="${t.image_path}" alt="첨부 이미지" />` : ''}
      <div class="card-footer">
        <div class="tag-row">${tags}</div>
        <div class="action-btns">${actionBtns}</div>
      </div>
    </div>
  `;
}

function filterByTaskStat(status, el) {
  document.querySelectorAll('#stats-area .stat').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  taskFilter = status;
  document.querySelectorAll('#section-tasks .fbtn').forEach(b => b.classList.remove('on'));
  renderTasks();
}

function filterTasks(status, btn) {
  taskFilter = status;
  document.querySelectorAll('#stats-area .stat').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('#section-tasks .fbtn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderTasks();
}

async function addTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) { alert('제목은 필수예요!'); return; }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('type', document.getElementById('task-type').value);
  formData.append('priority', document.getElementById('task-priority').value);
  formData.append('description', document.getElementById('task-description').value.trim());
  formData.append('tags', document.getElementById('task-tags').value.trim());
  formData.append('start_date', document.getElementById('task-start').value);
  formData.append('deadline', document.getElementById('task-deadline').value);
  const img = document.getElementById('task-image').files[0];
  if (img) formData.append('image', img);

  await fetch('/api/tasks', { method: 'POST', body: formData });
  ['task-title', 'task-description', 'task-tags', 'task-start', 'task-deadline'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('task-image').value = '';
  document.getElementById('task-file-name').textContent = '';
  loadTasks();
}

async function updateTaskStatus(id, status) {
  await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  loadTasks();
}

async function deleteTask(id) {
  if (!confirm('정말 삭제할까요?')) return;
  await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  loadTasks();
}

function toggleCompleted() {
  // 완료 항목은 이제 필터 버튼으로 관리
}

// ===== 완료 모달 =====
function openCompleteModal(taskId) {
  completingTaskId = taskId;
  document.getElementById('complete-modal').style.display = 'flex';
}

function closeCompleteModal() {
  completingTaskId = null;
  document.getElementById('complete-modal').style.display = 'none';
  document.getElementById('complete-note').value = '';
  document.getElementById('complete-image').value = '';
  document.getElementById('complete-file-name').textContent = '';
}

async function submitComplete() {
  if (!completingTaskId) return;
  const formData = new FormData();
  formData.append('note', document.getElementById('complete-note').value.trim());
  const img = document.getElementById('complete-image').files[0];
  if (img) formData.append('image', img);

  await fetch(`/api/tasks/${completingTaskId}/complete`, { method: 'POST', body: formData });
  closeCompleteModal();
  await Promise.all([loadTasks(), loadRecords()]);
}

// ===== 히스토리 =====
async function loadRecords() {
  const res = await fetch('/api/records');
  allRecords = await res.json();
  renderRecords(allRecords);
  updateStats();
}

function renderRecords(records) {
  const list = document.getElementById('records-list');
  if (records.length === 0) {
    list.innerHTML = '<div class="empty">아직 기록이 없어요. 첫 기록을 추가해봐요!</div>';
    return;
  }
  list.innerHTML = records.map(r => {
    const tags = r.tags ? r.tags.split(',').map(t => `<span class="tag">${t.trim()}</span>`).join('') : '';
    return `
      <div class="record-card type-${r.type}">
        <div class="card-top">
          <span class="badge badge-${r.type}">${r.type}</span>
          <span class="card-title">${r.title}</span>
          <span class="card-date">${r.date}</span>
        </div>
        ${r.description ? `<div class="card-desc">${r.description}</div>` : ''}
        ${r.image_path ? `<img class="card-image" src="${r.image_path}" alt="첨부 이미지" />` : ''}
        <div class="card-footer">
          <div class="tag-row">${tags}</div>
          <button class="del-btn" onclick="deleteRecord(${r.id})">삭제</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterRecords(type, btn) {
  document.querySelectorAll('#section-history .fbtn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderRecords(type === '전체' ? allRecords : allRecords.filter(r => r.type === type));
}

async function addRecord() {
  const type = document.getElementById('type').value;
  const dateStart = document.getElementById('date-start').value;
  const dateEnd = document.getElementById('date-end').value;
  const date = dateStart + (dateEnd ? ' ~ ' + dateEnd : '');
  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();
  const tags = document.getElementById('tags').value.trim();
  const imageFile = document.getElementById('image').files[0];

  if (!title || !dateStart) { alert('제목과 시작일은 필수예요!'); return; }

  const formData = new FormData();
  formData.append('type', type);
  formData.append('date', date);
  formData.append('title', title);
  formData.append('description', description);
  formData.append('tags', tags);
  if (imageFile) formData.append('image', imageFile);

  await fetch('/api/records', { method: 'POST', body: formData });
  ['title', 'description', 'tags', 'date-start', 'date-end'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('image').value = '';
  document.getElementById('file-name').textContent = '';
  loadRecords();
}

async function deleteRecord(id) {
  if (!confirm('정말 삭제할까요?')) return;
  await fetch(`/api/records/${id}`, { method: 'DELETE' });
  loadRecords();
}

function onTypeChange() {
  const type = document.getElementById('type').value;
  const wrap = document.getElementById('date-end-wrap');
  if (type === 'CS응대' || type === '장애내역') {
    wrap.style.visibility = 'hidden';
    wrap.style.opacity = '0';
    document.getElementById('date-end').value = '';
  } else {
    wrap.style.visibility = '';
    wrap.style.opacity = '';
  }
}

document.getElementById('image').addEventListener('change', function() {
  document.getElementById('file-name').textContent = this.files[0]?.name || '';
});
document.getElementById('task-image').addEventListener('change', function() {
  document.getElementById('task-file-name').textContent = this.files[0]?.name || '';
});
document.getElementById('complete-image').addEventListener('change', function() {
  document.getElementById('complete-file-name').textContent = this.files[0]?.name || '';
});

// ===== 테마 =====
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  document.getElementById('theme-toggle').textContent = next === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('devhistory-theme', next);
}

(function applyTheme() {
  const saved = localStorage.getItem('devhistory-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = saved === 'dark' ? '☀️' : '🌙';
  });
})();

// ===== 리플 =====
function createRipple(e) {
  const btn = e.currentTarget;
  const existing = btn.querySelector('.ripple');
  if (existing) existing.remove();
  const circle = document.createElement('span');
  const d = Math.max(btn.clientWidth, btn.clientHeight);
  const rect = btn.getBoundingClientRect();
  circle.className = 'ripple';
  circle.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX-rect.left-d/2}px;top:${e.clientY-rect.top-d/2}px`;
  btn.appendChild(circle);
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-primary,.fbtn,.tab,.btn-confirm,.btn-cancel,.status-btn,.theme-toggle');
  if (btn) createRipple({ currentTarget: btn, clientX: e.clientX, clientY: e.clientY });
});

init();
