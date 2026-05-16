/* ============================================================
   WinUsage renderer
   ============================================================ */

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

let settings = null;
let providers = [];
let expanded = false;

/* ---------- Boot ---------- */
(async () => {
  settings = await window.winbar?.getSettings();
  if (settings) applySettings(settings);
  providers = (await window.winbar?.listProviders()) || [];
  renderAll();

  const info = await window.winbar?.getSystemInfo();
  const hint = $('#foot-hint');
  if (hint && info?.providersFile) {
    hint.textContent = `Edit ${info.providersFile.split(/[\\/]/).pop()} to add more`;
    hint.title = info.providersFile;
  }
})();

window.winbar?.onSettings((next) => { settings = next; applySettings(next); renderAll(); });
window.winbar?.onProviders((list) => { providers = list || []; renderAll(); });
window.winbar?.onNotchToggle(() => setExpanded(!expanded));

setInterval(renderAll, 30 * 1000);

/* ---------- Settings ---------- */
function applySettings(s) {
  const root = document.documentElement;
  document.body.classList.toggle('theme-dark', s.theme !== 'light');
  document.body.classList.toggle('theme-light', s.theme === 'light');
  document.body.classList.toggle('pulse-low', !!s.pulseLow);
  root.style.setProperty('--radius', `${s.cornerRadius}px`);
  root.style.setProperty('--accent', s.accent);
  root.style.setProperty('--font-size', `${s.fontSize}px`);
}

/* ---------- Helpers ---------- */
function avgPercent(p) {
  const pcts = p.metrics.map((m) => m.percentLeft).filter((x) => typeof x === 'number');
  if (!pcts.length) return null;
  return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
}

function statusFor(p) {
  const a = avgPercent(p);
  if (a == null) return 'ok';
  if (a <= 15) return 'low';
  if (a <= 35) return 'warn';
  return 'ok';
}

function fmtReset(iso) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (isNaN(ms) || ms <= 0) return 'expired';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function fmtMetricRight(m) {
  if (typeof m.percentLeft === 'number') return `${m.percentLeft}% left`;
  if (typeof m.dollarsLeft === 'number') return `$${m.dollarsLeft.toFixed(2)} left`;
  if (m.note) return m.note;
  return '';
}

function svgIcon(iconKey) {
  const inner = window.WinUsageIcons?.iconFor(iconKey) || '';
  return `<svg viewBox="0 0 24 24" class="glyph-svg" aria-hidden="true">${inner}</svg>`;
}

/* ---------- Render ---------- */
function renderAll() {
  renderCollapsed();
  renderExpanded();
}

function renderCollapsed() {
  const root = $('#collapsed-view');
  root.innerHTML = '';
  if (!providers.length) {
    const empty = document.createElement('span');
    empty.className = 'cicon-tooltip';
    empty.textContent = 'No providers';
    root.appendChild(empty);
    return;
  }
  for (const p of providers) {
    root.appendChild(renderCollapsedIcon(p));
  }
}

function renderCollapsedIcon(p) {
  const pct = avgPercent(p);
  const fillPct = pct == null ? 100 : pct;
  const status = statusFor(p);

  const cicon = document.createElement('div');
  cicon.className = `cicon is-${status}`;
  cicon.style.setProperty('--brand', p.color);
  cicon.dataset.id = p.id;

  const r = 10;
  const C = 2 * Math.PI * r;
  const dashOffset = C * (1 - fillPct / 100);

  cicon.innerHTML = `
    <svg viewBox="0 0 24 24" class="ring" aria-hidden="true">
      <circle class="ring-track" cx="12" cy="12" r="${r}"/>
      <circle class="ring-fill" cx="12" cy="12" r="${r}"
              stroke-dasharray="${C.toFixed(2)}"
              stroke-dashoffset="${dashOffset.toFixed(2)}"/>
    </svg>
    <span class="glyph">${svgIcon(p.iconKey)}</span>
    <span class="cicon-tooltip">${p.name}${pct != null ? ` · ${pct}%` : ''}</span>
  `;

  cicon.addEventListener('click', (e) => {
    e.stopPropagation();
    setExpanded(true);
    setTimeout(() => scrollToProvider(p.id), 50);
  });
  return cicon;
}

function renderExpanded() {
  const list = $('#provider-list');
  list.innerHTML = '';
  if (!providers.length) {
    const empty = document.createElement('div');
    empty.className = 'pempty';
    empty.innerHTML = '<strong>No providers yet</strong>Edit providers.json or use the tray menu.';
    list.appendChild(empty);
    return;
  }
  for (const p of providers) list.appendChild(renderProviderCard(p));
}

function renderProviderCard(p) {
  const card = document.createElement('div');
  card.className = 'pcard';
  card.dataset.id = p.id;
  card.style.setProperty('--brand', p.color);

  const head = document.createElement('div');
  head.className = 'pcard-head';
  head.innerHTML = `
    <div class="pcard-icon">${svgIcon(p.iconKey)}</div>
    <div class="pcard-name">${escape(p.name)}</div>
    ${p.plan ? `<div class="pcard-plan">${escape(p.plan)}</div>` : ''}
  `;
  card.appendChild(head);

  for (const m of p.metrics) {
    card.appendChild(renderMetric(m, p));
  }

  return card;
}

function renderMetric(m, p) {
  const row = document.createElement('div');
  row.className = 'pmetric';
  const pct = typeof m.percentLeft === 'number' ? m.percentLeft : null;
  const isLow = pct != null && pct <= 15;
  const isWarn = pct != null && pct > 15 && pct <= 35;
  const fillClass = isLow ? 'is-low' : isWarn ? 'is-warn' : '';

  row.innerHTML = `
    <div class="pmetric-row">
      <span class="pmetric-label">${escape(m.label)}</span>
      <span class="pmetric-val">${escape(fmtMetricRight(m))}</span>
    </div>
    ${pct != null ? `
      <div class="pmetric-bar">
        <div class="pmetric-fill ${fillClass}" style="width: ${pct}%"></div>
      </div>
    ` : ''}
    ${m.resetsAt ? `<div class="pmetric-reset">Resets in ${escape(fmtReset(m.resetsAt))}</div>` : ''}
  `;
  return row;
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function scrollToProvider(id) {
  const el = $(`.pcard[data-id="${id}"]`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- Expand / collapse ---------- */
async function setExpanded(next) {
  expanded = !!next;
  document.body.classList.toggle('state-expanded', expanded);
  document.body.classList.toggle('state-collapsed', !expanded);
  await window.winbar?.setExpanded(expanded);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('.head-btn')) return;
  if (!expanded && e.target.closest('#collapsed-view')) {
    setExpanded(true);
  }
});

$('#btn-collapse').addEventListener('click', () => setExpanded(false));
$('#btn-open-file').addEventListener('click', () => window.winbar?.openProvidersFile());
$('#btn-position').addEventListener('click', async () => {
  const next = settings.position === 'bottom' ? 'top' : 'bottom';
  await window.winbar?.setSettings({ position: next });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && expanded) setExpanded(false);
});
