const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  position: 'center',
  width: 720,
  height: 36,
  topOffset: 6,
  opacity: 0.65,
  cornerRadius: 16,
  accent: '#0a84ff',
  theme: 'dark',
  fontSize: 13,
  showApple: true,
  showAppName: true,
  showMenus: true,
  showSpotlight: true,
  showControlCenter: true,
  showBluetooth: true,
  showBattery: true,
  showWifi: true,
  showVolume: true,
  showClock: true,
  showSeconds: false,
  clockFormat: '24h',
  appName: 'WinBar',
  autoHide: false,
  alwaysOnTop: true,
  showOnAllWorkspaces: true
};

function settingsPath() {
  return path.join(app.getPath('userData'), 'winmenubar-settings.json');
}

function loadSettings(forceDefaults = false) {
  const p = settingsPath();
  if (forceDefaults) return { ...DEFAULTS };
  try {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8');
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch (err) {
    console.error('[settings] load failed:', err);
  }
  return { ...DEFAULTS };
}

function saveSettings(settings) {
  const p = settingsPath();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('[settings] save failed:', err);
  }
}

module.exports = { loadSettings, saveSettings, DEFAULTS };
