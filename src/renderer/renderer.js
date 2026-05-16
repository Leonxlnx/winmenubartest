/* ============================================================
   WinMenuBar renderer — settings-aware
   ============================================================ */

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

let settings = null;

/* ---------- Apply settings to DOM ---------- */
function applySettings(next) {
  settings = next;
  const root = document.documentElement;
  document.body.classList.toggle('theme-dark', settings.theme === 'dark');
  document.body.classList.toggle('theme-light', settings.theme === 'light');

  root.style.setProperty('--bar-radius', `${settings.cornerRadius}px`);
  root.style.setProperty('--bar-font-size', `${settings.fontSize}px`);
  root.style.setProperty('--accent', settings.accent);

  const bg = settings.theme === 'light'
    ? `rgba(245, 245, 247, ${settings.opacity})`
    : `rgba(20, 20, 22, ${settings.opacity})`;
  root.style.setProperty('--bar-bg', bg);

  $$('.item[data-key]').forEach((el) => {
    const key = el.dataset.key;
    el.classList.toggle('is-hidden', settings[key] === false);
  });
  const center = $('.cluster-center');
  if (center) center.classList.toggle('is-hidden', settings.showMenus === false);

  const nameEl = $('#app-name-label');
  if (nameEl && settings.appName) nameEl.textContent = settings.appName;

  updateClock();
}

/* ---------- Live clock ---------- */
const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n) => String(n).padStart(2, '0');

function updateClock() {
  if (!settings) return;
  const now = new Date();
  const day = weekday[now.getDay()];
  const dateStr = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  let hh = now.getHours();
  let suffix = '';
  if (settings.clockFormat === '12h') {
    suffix = hh >= 12 ? ' PM' : ' AM';
    hh = hh % 12 || 12;
  }
  const mm = pad(now.getMinutes());
  const ss = settings.showSeconds ? `:${pad(now.getSeconds())}` : '';
  $('#clock-time').textContent = `${day} ${dateStr}  ${pad(hh)}:${mm}${ss}${suffix}`;
}
setInterval(updateClock, 1000);

/* ---------- Battery ---------- */
async function initBattery() {
  if (!navigator.getBattery) return;
  try {
    const battery = await navigator.getBattery();
    const render = () => {
      const pct = Math.round(battery.level * 100);
      $('#battery-pct').textContent = `${pct}%`;
      const fill = $('#battery-fill');
      fill.style.width = Math.max(8, pct) + '%';
      fill.classList.toggle('low', pct <= 20 && !battery.charging);
      fill.classList.toggle('charging', battery.charging);
    };
    render();
    battery.addEventListener('levelchange', render);
    battery.addEventListener('chargingchange', render);
  } catch {}
}
initBattery();

/* ---------- Wi-Fi online state ---------- */
function updateOnline() {
  const btn = $('#btn-wifi');
  if (!btn) return;
  btn.style.opacity = navigator.onLine ? '1' : '0.4';
  btn.title = navigator.onLine ? 'Wi-Fi: connected' : 'Wi-Fi: offline';
}
updateOnline();
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);

/* ---------- Dropdown menus ---------- */
const dropdownEl = $('#dropdown');
const dropdownInner = $('#dropdown-inner');
let openMenu = null;

const MENUS = {
  apple: [
    { header: 'System' },
    { label: 'About This Bar', action: 'about' },
    { separator: true },
    { label: 'System Settings…', action: 'osSettings' },
    { separator: true },
    { label: 'Quit WinBar', shortcut: 'Ctrl+Q', action: 'quit' }
  ],
  app: [
    { label: 'About WinBar', action: 'about' },
    { separator: true },
    { label: 'Customize…', shortcut: 'Ctrl+,', action: 'settings' },
    { separator: true },
    { label: 'Quit WinBar', shortcut: 'Ctrl+Q', action: 'quit' }
  ],
  file: [
    { label: 'New Window', shortcut: 'Ctrl+N', action: 'noop' },
    { label: 'New Tab', shortcut: 'Ctrl+T', action: 'noop' },
    { separator: true },
    { label: 'Open…', shortcut: 'Ctrl+O', action: 'noop' },
    { label: 'Close Window', shortcut: 'Ctrl+W', action: 'noop' }
  ],
  edit: [
    { label: 'Undo', shortcut: 'Ctrl+Z', action: 'noop' },
    { label: 'Redo', shortcut: 'Ctrl+Shift+Z', action: 'noop' },
    { separator: true },
    { label: 'Cut', shortcut: 'Ctrl+X', action: 'noop' },
    { label: 'Copy', shortcut: 'Ctrl+C', action: 'noop' },
    { label: 'Paste', shortcut: 'Ctrl+V', action: 'noop' }
  ],
  view: [
    { label: 'Customize Bar…', action: 'settings' },
    { separator: true },
    { label: 'Switch Theme', action: 'toggleTheme' },
    { label: 'Toggle Seconds', action: 'toggleSeconds' }
  ],
  window: [
    { label: 'Reset Bar Position', action: 'resetPos' },
    { separator: true },
    { label: 'Hide Bar (5s)', action: 'hideTemp' }
  ],
  help: [
    { label: 'WinBar Help', action: 'help' },
    { separator: true },
    { label: 'Open Project on GitHub', action: 'github' }
  ],
  spotlight: [
    { header: 'Search' },
    { label: 'Type to search…', action: 'noop', disabled: true }
  ],
  controlcenter: [
    { header: 'Control Center' },
    { label: 'Open Windows Settings', action: 'osSettings' },
    { separator: true },
    { label: 'Customize Bar…', action: 'settings' }
  ],
  bluetooth: [
    { header: 'Bluetooth' },
    { label: 'Open Bluetooth Settings', action: 'osSettings' }
  ],
  battery: [
    { header: 'Battery' },
    { label: 'Battery Settings…', action: 'osSettings' }
  ],
  wifi: [
    { header: 'Wi-Fi' },
    { label: 'Network Settings…', action: 'osSettings' }
  ],
  volume: [
    { header: 'Sound' },
    { label: 'Sound Settings…', action: 'osSettings' }
  ],
  clock: [
    { header: 'Clock' },
    { label: 'Toggle 12h / 24h', action: 'toggleClock' },
    { label: 'Toggle Seconds', action: 'toggleSeconds' },
    { separator: true },
    { label: 'Date & Time Settings…', action: 'osSettings' }
  ]
};

function renderDropdown(items) {
  dropdownInner.innerHTML = '';
  for (const item of items) {
    if (item.separator) {
      const el = document.createElement('div');
      el.className = 'dropdown-separator';
      dropdownInner.appendChild(el);
    } else if (item.header) {
      const el = document.createElement('div');
      el.className = 'dropdown-header';
      el.textContent = item.header;
      dropdownInner.appendChild(el);
    } else {
      const el = document.createElement('div');
      el.className = 'dropdown-item' + (item.disabled ? ' disabled' : '');
      const left = document.createElement('span');
      left.textContent = item.label;
      const right = document.createElement('span');
      right.className = 'shortcut';
      right.textContent = item.shortcut || '';
      el.appendChild(left);
      el.appendChild(right);
      el.addEventListener('click', () => handleAction(item.action));
      dropdownInner.appendChild(el);
    }
  }
}

function openMenuFor(button, key) {
  closeMenu();
  const items = MENUS[key];
  if (!items) return;
  closeSettings();
  button.classList.add('is-open');
  openMenu = button;
  renderDropdown(items);
  dropdownEl.hidden = false;
  const rect = button.getBoundingClientRect();
  const dw = dropdownEl.offsetWidth || 220;
  const left = Math.min(rect.left, window.innerWidth - dw - 4);
  dropdownEl.style.left = `${Math.max(2, left)}px`;
  dropdownEl.style.top = `${rect.bottom + 6}px`;
}

function closeMenu() {
  if (openMenu) {
    openMenu.classList.remove('is-open');
    openMenu = null;
  }
  dropdownEl.hidden = true;
}

async function handleAction(action) {
  closeMenu();
  switch (action) {
    case 'quit': window.winbar?.quit(); break;
    case 'osSettings': window.winbar?.openSettings(); break;
    case 'github': window.winbar?.openExternal('https://github.com/Leonxlnx/winmenubartest'); break;
    case 'settings': toggleSettings(); break;
    case 'toggleTheme':
      await window.winbar?.setSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
      break;
    case 'toggleSeconds':
      await window.winbar?.setSettings({ showSeconds: !settings.showSeconds });
      break;
    case 'toggleClock':
      await window.winbar?.setSettings({ clockFormat: settings.clockFormat === '24h' ? '12h' : '24h' });
      break;
    case 'resetPos':
      await window.winbar?.setSettings({ position: 'center' });
      break;
    case 'hideTemp':
      document.body.style.opacity = '0';
      setTimeout(() => { document.body.style.opacity = '1'; }, 5000);
      break;
    default: break;
  }
}

/* ---------- Settings panel (filled in next commit) ---------- */
const settingsPanel = $('#settings-panel');
function closeSettings() { settingsPanel.hidden = true; }
function toggleSettings() { settingsPanel.hidden = !settingsPanel.hidden; }

/* ---------- Click & hover wiring ---------- */
document.addEventListener('click', (e) => {
  if (e.target.closest('#settings-panel')) return;
  if (e.target.closest('#btn-settings')) { toggleSettings(); closeMenu(); return; }
  const target = e.target.closest('[data-menu], .item');
  if (!target || target.id === 'btn-settings') {
    closeMenu();
    closeSettings();
    return;
  }
  const key = target.dataset.menu || target.id.replace(/^btn-/, '');
  if (openMenu === target) { closeMenu(); return; }
  openMenuFor(target, key);
});

document.addEventListener('mouseover', (e) => {
  if (!openMenu) return;
  const target = e.target.closest('[data-menu], .item');
  if (!target || target === openMenu) return;
  const key = target.dataset.menu || target.id.replace(/^btn-/, '');
  if (MENUS[key]) openMenuFor(target, key);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeMenu(); closeSettings(); }
});

window.addEventListener('blur', () => { closeMenu(); });

/* ---------- Bootstrap ---------- */
(async () => {
  const initial = await window.winbar?.getSettings();
  if (initial) applySettings(initial);
})();

window.winbar?.onSettings((next) => applySettings(next));
