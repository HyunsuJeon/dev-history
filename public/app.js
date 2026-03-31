let allRecords = [];

async function loadRecords() {
  const res = await fetch('/api/records');
  allRecords = await res.json();
  updateStats();
  renderRecords(allRecords);
  onTypeChange();
}

function updateStats() {
  document.getElementById('stat-total').textContent = allRecords.length;
  document.getElementById('stat-feat').textContent = allRecords.filter(r => r.type === '기능개발').length;
  document.getElementById('stat-bug').textContent = allRecords.filter(r => r.type === '버그수정').length;
  document.getElementById('stat-cs').textContent = allRecords.filter(r => r.type === 'CS응대').length;
}

function renderRecords(records) {
  const list = document.getElementById('records-list');

  if (records.length === 0) {
    list.innerHTML = '<div class="empty">아직 기록이 없어요. 첫 기록을 추가해봐요!</div>';
    return;
  }

  list.innerHTML = records.map(r => {
    const tags = r.tags ? r.tags.split(',').map(t =>
      `<span class="tag">${t.trim()}</span>`
    ).join('') : '';

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
  document.querySelectorAll('.fbtn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  if (type === '전체') {
    renderRecords(allRecords);
  } else {
    renderRecords(allRecords.filter(r => r.type === type));
  }
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

  if (!title || !dateStart) {
    alert('제목과 시작일은 필수예요!');
    return;
  }

  const formData = new FormData();
  formData.append('type', type);
  formData.append('date', date);
  formData.append('title', title);
  formData.append('description', description);
  formData.append('tags', tags);
  if (imageFile) formData.append('image', imageFile);

  await fetch('/api/records', {
    method: 'POST',
    body: formData
  });

  document.getElementById('title').value = '';
  document.getElementById('description').value = '';
  document.getElementById('tags').value = '';
  document.getElementById('date-start').value = '';
  document.getElementById('date-end').value = '';
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
  const dateEndWrap = document.getElementById('date-end-wrap');
  if (type === 'CS응대') {
    dateEndWrap.style.visibility = 'hidden';
    dateEndWrap.style.opacity = '0';
    document.getElementById('date-end').value = '';
  } else {
    dateEndWrap.style.visibility = '';
    dateEndWrap.style.opacity = '';
  }
}

document.getElementById('image').addEventListener('change', function() {
  const name = this.files[0] ? this.files[0].name : '';
  document.getElementById('file-name').textContent = name;
});



loadRecords();
