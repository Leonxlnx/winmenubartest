# WinUsage Notch

A premium **docked notch for Windows** that visualises your AI coding
subscription usage at a glance, by reading from
[OpenUsage](https://openusage.ai/)'s local HTTP API on the same machine
(or a Mac on your network).

The notch lives flush against the top edge of your primary display, with
sharp top corners and a soft rounded bottom — it feels like part of the
screen instead of a floating window. Click it to expand into full
provider cards.

## How it gets the data

```
GET http://127.0.0.1:6736/v1/usage
GET http://127.0.0.1:6736/v1/usage/:providerId
```

OpenUsage already handles provider auth, scraping, and normalization for
Codex, Claude, Cursor, Copilot, Gemini, JetBrains AI, Windsurf and 10+
others. This app **does not** read Windsurf / Cursor / Claude auth files
directly — it only polls the local HTTP API every 60 seconds and renders
the cached snapshot.

If the API returns 204 or is unreachable, the notch shows a neutral
state (`OpenUsage offline` / `No data yet`) instead of stale data.

## Features

- **Docked to the top edge** of the primary display (no gap, sharp top corners)
- Compact icon row of every provider OpenUsage exposes, each with a
  **circular progress ring** that depletes as you burn quota
- **Brand colors and real OpenUsage SVG icons** (Codex, Claude, Cursor,
  Copilot, Gemini, JetBrains AI, Amp, Antigravity, Kimi, Kiro, MiniMax,
  OpenCode Go, Perplexity, Synthetic, Windsurf, Z.ai, Factory)
- Click to expand → per-provider cards with **progress lines**
  (label + bar + % left + reset countdown) and **text lines**
  (label + value), just like OpenUsage on macOS
- Color-coded urgency (green → amber → red), low-quota pulse
- Click a provider name → opens its usage dashboard in your browser
- System tray icon: show / hide / refresh / quit
- Global shortcuts: `Ctrl+Alt+B` toggle bar, `Ctrl+Alt+U` expand,
  `Ctrl+Alt+R` refresh from API
- Polls `GET /v1/usage` every 60 s; handles 204 / errors gracefully

## Run

```bash
npm install
npm start
```

On the same machine (or with an SSH tunnel forwarding port 6736), start
OpenUsage to feed the notch.

## Build a Windows installer

```bash
npm run build
```

Produces an NSIS installer and a portable `.exe` under `dist/`.

## Architecture

- `src/main.js` — Electron main. Top-edge docked window, IPC, tray,
  global shortcuts.
- `src/openusage-api.js` — Tiny HTTP client that polls
  `127.0.0.1:6736/v1/usage`, normalizes the response, emits snapshots.
- `src/settings.js` — Defaults + JSON persistence in `userData`.
- `src/preload.js` — Context-isolated bridge (`window.winbar`).
- `src/renderer/index.html` — Markup for collapsed icon row + expanded cards.
- `src/renderer/styles.css` — Docked-to-top look, brand-colored cards,
  progress rings, smooth animations.
- `src/renderer/renderer.js` — Renders provider snapshot, handles
  `progress` and `text` line types, manages expand/collapse.
- `src/renderer/icons/*.svg` — Real OpenUsage provider SVG icons,
  fetched once at render time and tinted via `currentColor`.
- `src/renderer/icons/brand.json` — Brand display name + color manifest.

## Credits

Provider icons, brand colors, and the live data shape come from
[OpenUsage by robinebers](https://github.com/robinebers/openusage)
(MIT licensed). This project re-uses the icons under their license.

## License

MIT
