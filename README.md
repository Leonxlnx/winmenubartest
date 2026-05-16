# WinMenuBar

A small, always-on-top, translucent **floating menu bar** that lives in the
middle of the top of your Windows screen. Inspired by the macOS menu bar but
built as a compact pill widget so it doesn't steal a whole row of pixels.

Built with Electron, fully customizable through a built-in settings panel,
and your preferences are persisted to disk.

## Features

- Pill-shaped, blurred, always-on-top floating bar
- Live clock (12h / 24h, optional seconds)
- Battery percentage with charging state
- Wi-Fi / online indicator
- Spotlight, Control Center, Bluetooth, Volume quick-access buttons
- Mac-style menus (File / Edit / View / Window / Help) with hover-to-switch dropdowns
- Built-in **Customize** panel (click the gear) with:
  - Position: **Left / Center / Right** + top offset
  - Size: width, height, corner radius, font size
  - Appearance: **Dark / Light** theme, opacity slider, **accent color picker**
  - Toggle each widget independently (Logo, App name, Menus, Spotlight, Control
    Center, Bluetooth, Battery, Wi-Fi, Volume, Clock)
  - Clock: 12h / 24h, show seconds
  - Custom app name
  - Reset all
- Persisted settings (`%APPDATA%\winmenubartest\winmenubar-settings.json`)
- Single-instance lock, survives display metric changes

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

## Architecture

- `src/main.js` — Electron main process. Computes window bounds from settings,
  creates the borderless transparent always-on-top window, hosts IPC.
- `src/settings.js` — Defaults + JSON persistence in `userData`.
- `src/preload.js` — Context-isolated bridge (`window.winbar`).
- `src/renderer/index.html` — The bar markup (left / center / right clusters).
- `src/renderer/styles.css` — Pill shape, blur, CSS variables driven by settings.
- `src/renderer/renderer.js` — Live clock, battery, dropdowns, settings wiring.
- `src/renderer/settings-panel.js` — Customize panel: toggles, sliders,
  segmented controls, color picker, text field.

## Stack

- [Electron](https://www.electronjs.org/)
- [electron-builder](https://www.electron.build/) (NSIS / portable installer)
- [koffi](https://koffi.dev/) (kept as a dep for future Windows-native extensions)

## License

MIT
