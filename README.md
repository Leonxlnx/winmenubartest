# WinUsage Notch

A premium **Dynamic-Island style notch for Windows** that tracks your AI
coding subscription quotas at a glance. Inspired by
[OpenUsage](https://openusage.ai/) for macOS, rebuilt as a tiny floating
notch that lives at the top (or bottom) of your screen.

Codex / Claude / Cursor / Copilot / Gemini / JetBrains / …  — each provider
gets a brand-colored icon with a progress ring. Click the notch to expand
into full provider cards showing **session %**, **weekly %**, **plan usage
in $**, and **time until reset**.

## Features

- **Tiny notch** in the middle of your screen (top or bottom dock)
- Provider icons with **brand colors** and a **circular progress ring**
- Color-coded urgency: green → amber → red as you burn through usage
- **Click to expand** into a full panel with metric bars and reset timers
- Premium glass background with subtle highlight + drop shadow
- **JSON-driven**: edit `providers.json` to add any provider — hot reload
- System tray icon for toggling visibility / dock position
- Global shortcuts: `Ctrl+Alt+B` show/hide · `Ctrl+Alt+U` expand
- Persists settings + provider data in `%APPDATA%\winmenubartest\`

## Run

```bash
npm install
npm start
```

## Build a Windows installer

```bash
npm run build
```

Produces an NSIS installer and a portable `.exe` under `dist/`.

## How to add providers

Open `providers.json` (tray menu → "Open providers.json") and add an entry
with this shape:

```json
{
  "id": "claude",
  "name": "Claude",
  "plan": "Max",
  "color": "#d97757",
  "iconKey": "claude",
  "metrics": [
    {
      "label": "Session",
      "percentLeft": 73,
      "resetsAt": "2026-05-17T08:00:00Z"
    },
    {
      "label": "Plan usage",
      "dollarsLeft": 167.78,
      "resetsAt": "2026-05-25T00:00:00Z"
    }
  ]
}
```

`iconKey` can be one of: `codex`, `claude`, `cursor`, `copilot`, `gemini`,
`jetbrains`, `windsurf`, `amp`, `factory`, `antigravity`, `perplexity`, or
falls back to a generic glyph. The file is **hot-reloaded** — any external
collector (a Python script, a cron job, a browser extension, an LLM agent)
can append to it and the notch updates within ~80 ms.

## Architecture

- `src/main.js` — Electron main; dynamic window bounds for collapsed
  (icons row) vs expanded (cards panel); tray + global shortcuts.
- `src/settings.js` — Defaults + JSON persistence (`<userData>/winmenubar-settings.json`).
- `src/providers.js` — Provider store + `fs.watch` hot-reload of
  `<userData>/providers.json`.
- `src/preload.js` — Context-isolated bridge (`window.winbar`).
- `src/renderer/index.html` — Notch markup (collapsed icons row + expanded cards).
- `src/renderer/styles.css` — Premium glass, progress rings, brand colors,
  micro-animations.
- `src/renderer/icons.js` — Hand-drawn SVG glyphs per provider.
- `src/renderer/renderer.js` — Render loop, click-to-expand, color status,
  reset countdowns.

## Stack

- [Electron](https://www.electronjs.org/)
- [electron-builder](https://www.electron.build/)
- [koffi](https://koffi.dev/) (kept for future Windows-native extensions)

## Credits

Inspired by [OpenUsage by robinebers](https://github.com/robinebers/openusage)
and the Windows port effort
[openusage-win by Luciano16-gif](https://github.com/Luciano16-gif/openusage-win).

## License

MIT
