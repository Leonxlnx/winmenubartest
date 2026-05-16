/* ============================================================
   WinNotch renderer
   ============================================================ */

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

let settings = null;
let tasksCache = [];
let expanded = false;

/* ---------- Boot ---------- */
(async () => {
  settings = await window.winbar?.getSettings();
  if (settings) applySettings(settings);
  tasksCache = (await window.winbar?.listTasks()) || [];
  renderAll();

  const info = await window.winbar?.getSystemInfo();
  if (info?.tasksFile) {
    const hint = $('#tasks-file-hint');
    if (hint) hint.textContent = info.tasksFile.split(/[\\/]/).pop();
    hint.title = info.tasksFile;
  }
})();

window.winbar?.onSettings((next) => { settings = next; applySettings(next); renderAll(); });
window.winbar?.onTasks((list) => { tasksCache = list || []; renderAll(); });
window.winbar?.onNotchToggle(() => setExpanded(!expanded));

/* ---------- Settings to DOM ---------- */
function applySettings(s) {
  const root = document.documentElement;
  document.body.classList.toggle('theme-dark', s.theme !== 'light');
  document.body.classList.toggle('theme-light', s.theme === 'light');
  root.style.setProperty('--radius', `${s.cornerRadius}px`);
  root.style.setProperty('--accent', s.accent);
  root.style.setProperty('--font-size', `${s.fontSize}px`);
}

/* ---------- Render ---------- */
function renderAll() {
  renderCollapsed();
  renderExpanded();
  updateStatusDot();
}

function counts() {
  const out = { total: tasksCache.length, running: 0, done: 0, failed: 0, queued: 0 };
  for (const t of tasksCache) out[t.status] = (out[t.status] || 0) + 1;
  return out;
}

function renderCollapsed() {
  const c = counts();
  const meta = $('#collapsed-meta');
  if (!meta) return;
  if (c.running > 0) meta.textContent = `${c.running} running`;
  else if (c.queued > 0) meta.textContent = `${c.queued} queued`;
  else if (c.failed > 0) meta.textContent = `${c.failed} failed`;
  else if (c.total > 0) meta.textContent = `all done`;
  else meta.textContent = `no tasks`;
}

function renderExpanded() {
  const c = counts();
  $('#head-count').textContent = c.total
    ? `${c.running} running · ${c.done} done${c.failed ? ` · ${c.failed} failed` : ''}`
    : '';

  const list = $('#task-list');
  list.innerHTML = '';

  if (!tasksCache.length) {
    const empty = document.createElement('div');
    empty.className = 'task-empty';
    empty.innerHTML = '<strong>No tasks yet</strong>Add one with the + button or write to tasks.json.';
    list.appendChild(empty);
    return;
  }

  const order = { running: 0, queued: 1, failed: 2, done: 3 };
  const sorted = tasksCache.slice().sort((a, b) => {
    const oa = order[a.status] ?? 9;
    const ob = order[b.status] ?? 9;
    if (oa !== ob) return oa - ob;
    return (b.startedAt || 0) - (a.startedAt || 0);
  });

  for (const task of sorted) list.appendChild(renderTask(task));
}

function renderTask(task) {
  const row = document.createElement('div');
  row.className = `task-row is-${task.status}`;
  row.dataset.id = task.id;

  const icon = document.createElement('div');
  icon.className = `task-icon is-${task.status}`;
  row.appendChild(icon);

  const body = document.createElement('div');
  body.className = 'task-body';
  const title = document.createElement('div');
  title.className = 'task-title';
  title.textContent = task.title;
  body.appendChild(title);

  const sub = document.createElement('div');
  sub.className = 'task-sub';
  sub.textContent = subFor(task);
  body.appendChild(sub);
  row.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'task-actions';
  if (task.status === 'running' || task.status === 'queued') {
    const doneBtn = document.createElement('button');
    doneBtn.className = 'task-act';
    doneBtn.title = 'Mark as done';
    doneBtn.textContent = '✓';
    doneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.winbar?.updateTask(task.id, { status: 'done' });
    });
    actions.appendChild(doneBtn);
  }
  const delBtn = document.createElement('button');
  delBtn.className = 'task-act';
  delBtn.title = 'Remove';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.winbar?.removeTask(task.id);
  });
  actions.appendChild(delBtn);
  row.appendChild(actions);

  return row;
}

function subFor(task) {
  const parts = [];
  if (task.source && task.source !== 'manual') parts.push(task.source);
  if (task.status === 'running' && task.startedAt) {
    parts.push(`for ${formatDuration(Date.now() - task.startedAt)}`);
  } else if ((task.status === 'done' || task.status === 'failed') && task.finishedAt) {
    parts.push(timeAgo(task.finishedAt));
  } else if (task.status === 'queued') {
    parts.push('waiting');
  }
  return parts.join(' · ');
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function updateStatusDot() {
  const c = counts();
  for (const el of $$('.status-dot')) {
    el.classList.remove('is-running', 'is-failed', 'is-queued');
    if (c.running > 0) el.classList.add('is-running');
    else if (c.failed > 0) el.classList.add('is-failed');
    else if (c.queued > 0) el.classList.add('is-queued');
  }
}

setInterval(() => {
  if (tasksCache.some((t) => t.status === 'running')) renderExpanded();
}, 1000);

/* ---------- Expand / collapse ---------- */
async function setExpanded(next) {
  expanded = !!next;
  document.body.classList.toggle('state-expanded', expanded);
  document.body.classList.toggle('state-collapsed', !expanded);
  await window.winbar?.setExpanded(expanded);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('#add-modal')) return;
  if (e.target.closest('.head-btn')) return;
  if (e.target.closest('.task-actions')) return;
  if (!expanded && e.target.closest('#collapsed-view')) {
    setExpanded(true);
  } else if (expanded && e.target.closest('#expanded-view') && !e.target.closest('.task-row')) {
    /* clicking on header area but not buttons does nothing */
  }
});

$('#btn-collapse').addEventListener('click', () => setExpanded(false));
$('#btn-clear').addEventListener('click', () => window.winbar?.clearDoneTasks());
$('#btn-open-file').addEventListener('click', () => window.winbar?.openTasksFile());
$('#btn-add').addEventListener('click', () => openAddModal());

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('#add-modal').hidden) closeAddModal();
    else if (expanded) setExpanded(false);
  }
});

/* ---------- Add task modal ---------- */
const addModal = $('#add-modal');
const addTitle = $('#add-title');
function openAddModal() {
  addModal.hidden = false;
  setTimeout(() => addTitle.focus(), 30);
}
function closeAddModal() {
  addModal.hidden = true;
  addTitle.value = '';
}
$('#add-cancel').addEventListener('click', closeAddModal);
$('#add-confirm').addEventListener('click', () => {
  const t = addTitle.value.trim();
  if (!t) { closeAddModal(); return; }
  window.winbar?.addTask({ title: t, status: 'running', source: 'notch' });
  closeAddModal();
});
addTitle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#add-confirm').click();
});
