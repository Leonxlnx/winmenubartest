const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  collapsedIconSize: 22,
  collapsedGap: 6,
  collapsedPadX: 12,
  collapsedHeight: 32,
  expandedWidth: 360,
  expandedMaxHeight: 420,
  position: 'top',
  topOffset: 6,
  bottomOffset: 8,
  cornerRadius: 16,
  theme: 'dark',
  accent: '#0a84ff',
  fontSize: 12,
  alwaysOnTop: true,
  showOnAllWorkspaces: true,
  showLabels: false,
  pulseLow: true
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
