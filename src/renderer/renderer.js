/* ============================================================
   WinUsage renderer — OpenUsage HTTP API shape
   ============================================================ */

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

let settings = null;
let snapshot = { ok: true, providers: [], empty: true };
let activeTools = [];
let expanded = false;
let brandMap = {};
const iconCache = new Map();

/* ---------- Boot ---------- */
(async () => {
  brandMap = await fetch('icons/brand.json').then((r) => r.json()).catch(() => ({}));
  settings = await window.winbar?.getSettings();
  if (settings) applySettings(settings);
  snapshot = (await window.winbar?.listProviders()) || snapshot;
  activeTools = (await window.winbar?.listActive()) || [];
  await preloadIcons();
  await preloadActiveIcons();
  renderAll();
})();

window.winbar?.onSettings((next) => { settings = next; applySettings(next); renderAll(); });
window.winbar?.onProviders(async (snap) => {
  snapshot = snap || snapshot;
  await preloadIcons();
  renderAll();
});
window.winbar?.onActive(async (list) => {
  activeTools = list || [];
  await preloadActiveIcons();
  renderAll();
});
window.winbar?.onNotchToggle(() => setExpanded(!expanded));

setInterval(() => { if (expanded) renderExpanded(); }, 30 * 1000);

/* ---------- Icon loading ---------- */
async function loadIcon(key) {
  if (iconCache.has(key)) return iconCache.get(key);
  try {
    const txt = await fetch(`icons/${key}.svg`).then((r) => r.text());
    const viewBoxMatch = txt.match(/viewBox\s*=\s*"([^"]+)"/i);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 100 100';
    const inner = txt
      .replace(/<\?xml[^?]*\?>/gi, '')
      .replace(/<svg[^>]*>/i, '')
      .replace(/<\/svg>\s*$/i, '')
      .replace(/<title>[^<]*<\/title>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .trim();
    const data = { viewBox, inner };
    iconCache.set(key, data);
    return data;
  } catch {
    const data = { viewBox: '0 0 24 24', inner: '' };
    iconCache.set(key, data);
    return data;
  }
}

async function preloadIcons() {
  const keys = new Set((snapshot.providers || []).map((p) => p.providerId));
  await Promise.all(Array.from(keys).map(loadIcon));
}

async function preloadActiveIcons() {
  const keys = new Set((activeTools || []).map((t) => t.id));
  await Promise.all(Array.from(keys).map(loadIcon));
}

function svgFor(key) {
  const data = iconCache.get(key) || { viewBox: '0 0 24 24', inner: '' };
  return `<svg viewBox="${data.viewBox}" preserveAspectRatio="xMidYMid meet" class="glyph-svg" aria-hidden="true">${data.inner}</svg>`;
}

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

/* ---------- Metric helpers ---------- */
function primaryProgress(p) {
  return (p.lines || []).find((l) => l && l.type === 'progress' && typeof l.used === 'number' && typeof l.limit === 'number' && l.limit > 0);
}

function percentLeft(line) {
  if (!line || !line.limit) return null;
  const used = line.used ?? 0;
  return Math.max(0, Math.min(100, Math.round(100 - (used / line.limit) * 100)));
}

function statusFor(p) {
  const primary = primaryProgress(p);
  const pct = percentLeft(primary);
  if (pct == null) return 'ok';
  if (pct <= 15) return 'low';
  if (pct <= 35) return 'warn';
  return 'ok';
}

function fmtProgressRight(line) {
  if (!line) return '';
  if (line.limit == null) return `${line.used}`;
  const fmt = line.format || { kind: 'percent' };
  const pctLeft = percentLeft(line);
  if (fmt.kind === 'currency' || fmt.kind === 'money' || fmt.unit === '$') {
    const left = (line.limit - (line.used ?? 0));
    return `$${left.toFixed(0)} left`;
  }
  if (fmt.kind === 'count' || fmt.kind === 'integer') {
    return `${line.used}/${line.limit}`;
  }
  return `${pctLeft}%`;
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

function brandFor(id) {
  return brandMap[id] || { name: id, color: '#7d7d80' };
}

/* ---------- Render ---------- */
function renderAll() {
  renderCollapsed();
  renderExpanded();
}

function renderCollapsed() {
  const root = $('#collapsed-view');
  root.innerHTML = '';

  if (!activeTools.length) {
    root.innerHTML = `<span class="cdot cdot-mute"></span><span class="ctext">Idle</span>`;
    return;
  }

  // Pulse dot when AI tools are running
  const pill = document.createElement('div');
  pill.className = 'crun';
  pill.innerHTML = `<span class="cdot cdot-live"></span>`;

  // Show up to 4 logos, then "+N" if more
  const max = 4;
  const shown = activeTools.slice(0, max);
  const extra = activeTools.length - shown.length;

  for (const t of shown) {
    const brand = brandFor(t.id);
    const chip = document.createElement('span');
    chip.className = 'cchip';
    chip.dataset.id = t.id;
    chip.style.setProperty('--brand', brand.color);
    chip.innerHTML = svgFor(t.id);
    chip.title = t.name;
    pill.appendChild(chip);
  }
  if (extra > 0) {
    const more = document.createElement('span');
    more.className = 'cmore';
    more.textContent = `+${extra}`;
    pill.appendChild(more);
  }

  // Final label
  const label = document.createElement('span');
  label.className = 'ctext';
  label.textContent = activeTools.length === 1
    ? `${activeTools[0].name} active`
    : `${activeTools.length} AI active`;
  pill.appendChild(label);

  root.appendChild(pill);
}

function renderCollapsedIcon(p) {
  const brand = brandFor(p.providerId);
  const primary = primaryProgress(p);
  const pct = percentLeft(primary);
  const fillPct = pct == null ? 100 : pct;
  const status = statusFor(p);

  const cicon = document.createElement('div');
  cicon.className = `cicon is-${status}`;
  cicon.style.setProperty('--brand', brand.color);
  cicon.dataset.id = p.providerId;

  const r = 10;
  const C = 2 * Math.PI * r;
  const dashOffset = C * (1 - fillPct / 100);

  const showBadge = pct != null && pct <= 20;
  cicon.innerHTML = `
    <svg viewBox="0 0 24 24" class="ring" aria-hidden="true">
      <circle class="ring-track" cx="12" cy="12" r="${r}"/>
      <circle class="ring-fill" cx="12" cy="12" r="${r}"
              stroke-dasharray="${C.toFixed(2)}"
              stroke-dashoffset="${dashOffset.toFixed(2)}"/>
    </svg>
    <span class="glyph">${svgFor(p.providerId)}</span>
    ${showBadge ? `<span class="cicon-badge">${pct}</span>` : ''}
    <span class="cicon-tooltip">${escapeHtml(p.displayName)}${pct != null ? ` · ${pct}% left` : ''}${p.plan ? ` · ${escapeHtml(p.plan)}` : ''}</span>
  `;

  cicon.addEventListener('click', (e) => {
    e.stopPropagation();
    setExpanded(true);
    setTimeout(() => scrollToProvider(p.providerId), 60);
  });
  return cicon;
}

function renderExpanded() {
  const list = $('#provider-list');
  list.innerHTML = '';
  const providers = snapshot.providers || [];

  if (!snapshot.ok) {
    list.appendChild(renderEmpty('OpenUsage offline', 'Start OpenUsage to populate.'));
    return;
  }
  if (snapshot.empty || !providers.length) {
    list.appendChild(renderEmpty('No data yet', 'Waiting for OpenUsage.'));
    return;
  }
  for (const p of providers) list.appendChild(renderProviderRow(p));
}

function renderEmpty(title, hint) {
  const el = document.createElement('div');
  el.className = 'pempty';
  el.innerHTML = `<strong>${escapeHtml(title)}</strong>${escapeHtml(hint)}`;
  return el;
}

function renderProviderRow(p) {
  const brand = brandFor(p.providerId);
  const row = document.createElement('div');
  row.className = 'prow';
  row.dataset.id = p.providerId;
  row.style.setProperty('--brand', brand.color);

  const primary = primaryProgress(p);
  const pct = percentLeft(primary);
  const isLow = pct != null && pct <= 15;
  const isWarn = pct != null && pct > 15 && pct <= 35;
  const valClass = isLow ? 'is-low' : isWarn ? 'is-warn' : '';
  const valText = primary ? fmtProgressRight(primary) : '—';
  const label = primary?.label || '';
  const reset = primary?.resetsAt ? fmtReset(primary.resetsAt) : '';

  row.innerHTML = `
    <div class="prow-icon" data-id="${escapeHtml(p.providerId)}">${svgFor(p.providerId)}</div>
    <div class="prow-main">
      <div class="prow-name">${escapeHtml(p.displayName)}</div>
      <div class="prow-sub">${label ? escapeHtml(label) : ''}${reset ? `<span class="prow-dot">·</span>${escapeHtml(reset)} left` : ''}</div>
    </div>
    <div class="prow-val ${valClass}">${escapeHtml(valText)}</div>
  `;
  row.addEventListener('click', () => window.winbar?.openProviderDashboard(p.providerId));
  return row;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
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
  if (e.target.closest('.pcard')) return;
  if (!expanded && e.target.closest('#collapsed-view')) setExpanded(true);
});

/* Click handler: collapsed → expand, expanded outside row → collapse */
document.addEventListener('click', (e) => {
  if (!expanded) {
    if (e.target.closest('#collapsed-view')) setExpanded(true);
    return;
  }
  if (e.target.closest('.prow')) return;
  setExpanded(false);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && expanded) setExpanded(false);
});
