/* ============================================================
   WinMenuBar renderer
   ============================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ---------- Live clock ---------- */
const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function updateClock() {
  const now = new Date();
  const d = weekday[now.getDay()];
  const hours = now.getHours();
  const mins = pad(now.getMinutes());
  $("#clock-day").textContent = `${d} ${now.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  })}`;
  $("#clock-time").textContent = `${pad(hours)}:${mins}`;
}
updateClock();
setInterval(updateClock, 1000);

/* ---------- Battery ---------- */
async function initBattery() {
  if (!navigator.getBattery) {
    $("#battery-pct").textContent = "—";
    return;
  }
  try {
    const battery = await navigator.getBattery();
    const render = () => {
      const pct = Math.round(battery.level * 100);
      $("#battery-pct").textContent = `${pct}%`;
      const fill = $("#battery-fill");
      fill.style.width = Math.max(8, pct) + "%";
      fill.classList.toggle("low", pct <= 20 && !battery.charging);
      fill.classList.toggle("charging", battery.charging);
    };
    render();
    battery.addEventListener("levelchange", render);
    battery.addEventListener("chargingchange", render);
  } catch {
    $("#battery-pct").textContent = "—";
  }
}
initBattery();

/* ---------- Wi-Fi ---------- */
function updateOnline() {
  const btn = $("#btn-wifi");
  btn.style.opacity = navigator.onLine ? "1" : "0.4";
  btn.title = navigator.onLine ? "Wi-Fi: connected" : "Wi-Fi: offline";
}
updateOnline();
window.addEventListener("online", updateOnline);
window.addEventListener("offline", updateOnline);

/* ---------- Menu / dropdown system ---------- */
const dropdownEl = $("#dropdown");
const dropdownInner = $("#dropdown-inner");
let openMenu = null;

const MENUS = {
  apple: [
    { header: "System" },
    { label: "About This Bar", action: "about" },
    { separator: true },
    { label: "System Settings…", action: "settings" },
    { separator: true },
    { label: "Sleep", action: "noop", disabled: true },
    { label: "Restart…", action: "noop", disabled: true },
    { label: "Shut Down…", action: "noop", disabled: true },
    { separator: true },
    { label: "Quit WinBar", shortcut: "⌘Q", action: "quit" }
  ],
  app: [
    { label: "About WinBar", action: "about" },
    { separator: true },
    { label: "Preferences…", shortcut: "⌘,", action: "settings" },
    { separator: true },
    { label: "Hide WinBar", shortcut: "⌘H", action: "noop", disabled: true },
    { label: "Hide Others", shortcut: "⌥⌘H", action: "noop", disabled: true },
    { separator: true },
    { label: "Quit WinBar", shortcut: "⌘Q", action: "quit" }
  ],
  file: [
    { label: "New Window", shortcut: "⌘N", action: "noop" },
    { label: "New Tab", shortcut: "⌘T", action: "noop" },
    { separator: true },
    { label: "Open…", shortcut: "⌘O", action: "noop" },
    { label: "Open Recent", action: "noop", disabled: true },
    { separator: true },
    { label: "Close Window", shortcut: "⌘W", action: "noop" }
  ],
  edit: [
    { label: "Undo", shortcut: "⌘Z", action: "noop" },
    { label: "Redo", shortcut: "⇧⌘Z", action: "noop" },
    { separator: true },
    { label: "Cut", shortcut: "⌘X", action: "noop" },
    { label: "Copy", shortcut: "⌘C", action: "noop" },
    { label: "Paste", shortcut: "⌘V", action: "noop" },
    { label: "Select All", shortcut: "⌘A", action: "noop" }
  ],
  view: [
    { label: "Show Toolbar", action: "noop" },
    { label: "Show Status Bar", action: "noop" },
    { separator: true },
    { label: "Enter Full Screen", shortcut: "⌃⌘F", action: "noop" }
  ],
  window: [
    { label: "Minimize", shortcut: "⌘M", action: "noop", disabled: true },
    { label: "Zoom", action: "noop", disabled: true },
    { separator: true },
    { label: "Bring All to Front", action: "noop" }
  ],
  help: [
    { label: "WinBar Help", shortcut: "⌘?", action: "help" },
    { separator: true },
    { label: "Open Project on GitHub", action: "github" }
  ],
  spotlight: [
    { header: "Search" },
    { label: "Type to search…", action: "noop", disabled: true }
  ],
  controlcenter: [
    { header: "Control Center" },
    { label: "Toggle Wi-Fi", action: "noop" },
    { label: "Toggle Bluetooth", action: "noop" },
    { separator: true },
    { label: "Open Windows Settings", action: "settings" }
  ],
  bluetooth: [
    { header: "Bluetooth" },
    { label: "Bluetooth: On", action: "noop", disabled: true },
    { separator: true },
    { label: "Open Bluetooth Settings", action: "settings" }
  ],
  battery: [
    { header: "Battery" },
    { label: "Power Source", action: "noop", disabled: true },
    { separator: true },
    { label: "Battery Settings…", action: "settings" }
  ],
  wifi: [
    { header: "Wi-Fi" },
    { label: "Network", action: "noop", disabled: true },
    { separator: true },
    { label: "Network Settings…", action: "settings" }
  ],
  volume: [
    { header: "Sound" },
    { label: "Mute", action: "noop" },
    { separator: true },
    { label: "Sound Settings…", action: "settings" }
  ],
  clock: [
    { header: "Clock" },
    { label: "Today", action: "noop", disabled: true },
    { separator: true },
    { label: "Date & Time Settings…", action: "settings" }
  ]
};

function renderDropdown(items) {
  dropdownInner.innerHTML = "";
  for (const item of items) {
    if (item.separator) {
      const el = document.createElement("div");
      el.className = "dropdown-separator";
      dropdownInner.appendChild(el);
    } else if (item.header) {
      const el = document.createElement("div");
      el.className = "dropdown-header";
      el.textContent = item.header;
      dropdownInner.appendChild(el);
    } else {
      const el = document.createElement("div");
      el.className = "dropdown-item" + (item.disabled ? " disabled" : "");
      const left = document.createElement("span");
      left.textContent = item.label;
      const right = document.createElement("span");
      right.className = "shortcut";
      right.textContent = item.shortcut || "";
      el.appendChild(left);
      el.appendChild(right);
      el.addEventListener("click", () => handleAction(item.action));
      dropdownInner.appendChild(el);
    }
  }
}

function openMenuFor(button, key) {
  closeMenu();
  const items = MENUS[key];
  if (!items) return;
  button.classList.add("is-open");
  openMenu = button;
  renderDropdown(items);
  dropdownEl.hidden = false;
  const rect = button.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth - dropdownEl.offsetWidth - 4);
  dropdownEl.style.left = `${Math.max(2, left)}px`;
  dropdownEl.style.top = `30px`;
}

function closeMenu() {
  if (openMenu) {
    openMenu.classList.remove("is-open");
    openMenu = null;
  }
  dropdownEl.hidden = true;
}

function handleAction(action) {
  closeMenu();
  switch (action) {
    case "quit":
      window.winbar?.quit();
      break;
    case "settings":
      window.winbar?.openSettings();
      break;
    case "github":
      window.winbar?.openExternal("https://github.com/Leonxlnx/winmenubartest");
      break;
    case "about":
    case "help":
    default:
      break;
  }
}

document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-menu], .status-item");
  if (!target) {
    closeMenu();
    return;
  }
  const key = target.dataset.menu || target.id.replace(/^btn-/, "");
  if (openMenu === target) {
    closeMenu();
    return;
  }
  openMenuFor(target, key);
});

document.addEventListener("mouseover", (e) => {
  if (!openMenu) return;
  const target = e.target.closest("[data-menu], .status-item");
  if (!target || target === openMenu) return;
  const key = target.dataset.menu || target.id.replace(/^btn-/, "");
  if (MENUS[key]) {
    openMenuFor(target, key);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});

window.addEventListener("blur", () => closeMenu());
