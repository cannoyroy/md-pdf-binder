const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const btnMerge = document.getElementById('btn-merge');
const btnExport = document.getElementById('btn-export');
const preview = document.getElementById('preview');
const chkTOC = document.getElementById('chk-toc');

// ---- 文件存储 ----
// { id, name, content }
let files = [];
let nextId = 0;

// ---- 拖入区域 ----
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  addFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = '';
});

function addFiles(fileListObj) {
  for (const f of fileListObj) {
    const reader = new FileReader();
    reader.onload = () => {
      files.push({ id: nextId++, name: f.name, content: reader.result });
      renderList();
    };
    reader.readAsText(f);
  }
}

// ---- 文件列表渲染 ----
function renderList() {
  fileList.innerHTML = '';
  files.forEach((f, i) => {
    const li = document.createElement('li');
    li.dataset.id = f.id;

    li.innerHTML = `
      <span class="drag-handle">⠿</span>
      <span class="filename" title="${f.name}">${f.name}</span>
      <button class="btn-up" title="上移" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button class="btn-down" title="下移" ${i === files.length - 1 ? 'disabled' : ''}>▼</button>
      <button class="btn-remove" title="移除">×</button>
    `;

    li.querySelector('.btn-up').addEventListener('click', () => move(i, -1));
    li.querySelector('.btn-down').addEventListener('click', () => move(i, 1));
    li.querySelector('.btn-remove').addEventListener('click', () => removeFile(f.id));

    fileList.appendChild(li);
  });

  const hasFiles = files.length > 0;
  btnMerge.disabled = !hasFiles;
  btnExport.disabled = !hasFiles;
}

function move(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= files.length) return;
  [files[index], files[target]] = [files[target], files[index]];
  renderList();
}

function removeFile(id) {
  files = files.filter(f => f.id !== id);
  renderList();
}

// ---- SortableJS 拖拽排序 ----
new Sortable(fileList, {
  handle: '.drag-handle',
  animation: 150,
  ghostClass: 'sortable-ghost',
  onEnd: () => {
    const newOrder = [...fileList.querySelectorAll('li')].map(li => Number(li.dataset.id));
    files = newOrder.map(id => files.find(f => f.id === id));
  },
});

// ---- 合并预览 ----
btnMerge.addEventListener('click', async () => {
  const ordered = files.map(f => ({ name: f.name, content: f.content }));
  const res = await fetch('/api/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: ordered, includeTOC: chkTOC.checked }),
  });
  const html = await res.text();
  preview.innerHTML = html;
});

// ---- 导出 PDF ----
btnExport.addEventListener('click', async () => {
  btnExport.disabled = true;
  btnExport.textContent = '生成中…';

  const ordered = files.map(f => ({ name: f.name, content: f.content }));
  const res = await fetch('/api/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: ordered, includeTOC: chkTOC.checked }),
  });

  if (!res.ok) {
    alert('PDF 导出失败');
    btnExport.disabled = false;
    btnExport.textContent = '导出 PDF';
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'merged-output.pdf';
  a.click();
  URL.revokeObjectURL(url);

  btnExport.disabled = false;
  btnExport.textContent = '导出 PDF';
});
