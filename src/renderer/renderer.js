/* ============================================================
   WinUsage renderer — OpenUsage HTTP API shape
   ============================================================ */

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

let settings = null;
let snapshot = { ok: true, providers: [], empty: true };
let expanded = false;
let brandMap = {};
const iconCache = new Map();

/* ---------- Boot ---------- */
(async () => {
  brandMap = await fetch('icons/brand.json').then((r) => r.json()).catch(() => ({}));
  settings = await window.winbar?.getSettings();
  if (settings) applySettings(settings);
  snapshot = (await window.winbar?.listProviders()) || snapshot;
  await preloadIcons();
  renderAll();
})();

window.winbar?.onSettings((next) => { settings = next; applySettings(next); renderAll(); });
window.winbar?.onProviders(async (snap) => {
  snapshot = snap || snapshot;
  await preloadIcons();
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
    return `$${left.toFixed(2)} left`;
  }
  if (fmt.kind === 'count' || fmt.kind === 'integer') {
    return `${line.used}/${line.limit}`;
  }
  return `${pctLeft}% left`;
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

  const providers = snapshot.providers || [];

  if (!snapshot.ok) {
    root.innerHTML = `<span class="dot dot-warn"></span><span class="state-text">OpenUsage offline</span>`;
    return;
  }
  if (snapshot.empty || !providers.length) {
    root.innerHTML = `<span class="dot dot-mute"></span><span class="state-text">No data yet</span>`;
    return;
  }

  for (const p of providers) root.appendChild(renderCollapsedIcon(p));
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

  cicon.innerHTML = `
    <svg viewBox="0 0 24 24" class="ring" aria-hidden="true">
      <circle class="ring-track" cx="12" cy="12" r="${r}"/>
      <circle class="ring-fill" cx="12" cy="12" r="${r}"
              stroke-dasharray="${C.toFixed(2)}"
              stroke-dashoffset="${dashOffset.toFixed(2)}"/>
    </svg>
    <span class="glyph">${svgFor(p.providerId)}</span>
    <span class="cicon-tooltip">${escapeHtml(p.displayName)}${pct != null ? ` · ${pct}%` : ''}</span>
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

  setStatusBadge();

  if (!snapshot.ok) {
    list.appendChild(renderEmpty(
      'OpenUsage offline',
      `Couldn't reach <code>${escapeHtml(settings?.apiBaseUrl || 'http://127.0.0.1:6736')}</code>. Start OpenUsage on your Mac and the notch will populate.`
    ));
    return;
  }
  if (snapshot.empty || !providers.length) {
    list.appendChild(renderEmpty('No data yet', 'OpenUsage is reachable but hasn\'t returned any provider snapshots yet.'));
    return;
  }
  for (const p of providers) list.appendChild(renderProviderCard(p));
}

function setStatusBadge() {
  const el = $('#head-status');
  if (!el) return;
  if (!snapshot.ok) { el.textContent = 'offline'; el.className = 'head-status is-bad'; return; }
  if (snapshot.empty) { el.textContent = 'no data'; el.className = 'head-status is-mute'; return; }
  const at = snapshot.fetchedAt ? new Date(snapshot.fetchedAt) : null;
  el.textContent = at ? `updated ${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'live';
  el.className = 'head-status is-ok';
}

function renderEmpty(title, html) {
  const el = document.createElement('div');
  el.className = 'pempty';
  el.innerHTML = `<strong>${escapeHtml(title)}</strong>${html}`;
  return el;
}

function renderProviderCard(p) {
  const brand = brandFor(p.providerId);
  const card = document.createElement('div');
  card.className = 'pcard';
  card.dataset.id = p.providerId;
  card.style.setProperty('--brand', brand.color);

  const head = document.createElement('div');
  head.className = 'pcard-head';
  head.innerHTML = `
    <div class="pcard-icon">${svgFor(p.providerId)}</div>
    <div class="pcard-name">${escapeHtml(p.displayName)}</div>
    ${p.plan ? `<div class="pcard-plan">${escapeHtml(p.plan)}</div>` : ''}
  `;
  head.addEventListener('click', () => window.winbar?.openProviderDashboard(p.providerId));
  card.appendChild(head);

  if (!p.lines || !p.lines.length) {
    const e = document.createElement('div');
    e.className = 'pcard-empty';
    e.textContent = 'No data';
    card.appendChild(e);
  } else {
    for (const l of p.lines) {
      if (!l) continue;
      if (l.type === 'progress') card.appendChild(renderProgressLine(l));
      else if (l.type === 'text') card.appendChild(renderTextLine(l));
    }
  }
  return card;
}

function renderProgressLine(l) {
  const row = document.createElement('div');
  row.className = 'pline pline-progress';
  const pct = percentLeft(l);
  const isLow = pct != null && pct <= 15;
  const isWarn = pct != null && pct > 15 && pct <= 35;
  const fillClass = isLow ? 'is-low' : isWarn ? 'is-warn' : '';
  const usedPct = pct != null ? 100 - pct : 0;

  row.innerHTML = `
    <div class="pline-row">
      <span class="pline-label">${escapeHtml(l.label)}</span>
      <span class="pline-val">${escapeHtml(fmtProgressRight(l))}</span>
    </div>
    ${pct != null ? `
      <div class="pline-bar">
        <div class="pline-fill ${fillClass}" style="width: ${usedPct}%"></div>
      </div>
    ` : ''}
    ${l.resetsAt ? `<div class="pline-reset">Resets in ${escapeHtml(fmtReset(l.resetsAt))}</div>` : ''}
  `;
  return row;
}

function renderTextLine(l) {
  const row = document.createElement('div');
  row.className = 'pline pline-text';
  row.innerHTML = `
    <span class="pline-label">${escapeHtml(l.label)}</span>
    <span class="pline-val">${escapeHtml(l.value)}</span>
  `;
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

$('#btn-collapse').addEventListener('click', () => setExpanded(false));
$('#btn-refresh').addEventListener('click', async () => {
  $('#btn-refresh').classList.add('is-spinning');
  await window.winbar?.refreshProviders();
  setTimeout(() => $('#btn-refresh').classList.remove('is-spinning'), 600);
});
$('#btn-openusage').addEventListener('click', () => window.winbar?.openOpenusageRelease());

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && expanded) setExpanded(false);
});
