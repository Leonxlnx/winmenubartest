# WinMenuBar

A macOS-style menu bar for Windows. A translucent, blurred, always-on-top bar
pinned to the top edge of your primary display — the way it just feels right
on a MacBook.

It's built with Electron, and uses the native Windows **AppBar API** via
`koffi` FFI so the bar actually reserves screen real estate (no other window
can ever overlap it — the same way the macOS menu bar behaves and the same way
the Windows taskbar reserves space at the bottom).

![Inspired by the macOS Sonoma menu bar](https://images.unsplash.com/photo-1496181133206-80ce9b88a853?q=80&w=1600)

## Features

- Translucent dark bar with backdrop blur (acrylic feel)
- Reserves real screen space at the top via the **Windows AppBar API** (`SHAppBarMessage`)
- Always-on-top, skips taskbar, ignored by Alt-Tab
- Native click-through menus (File, Edit, View, Window, Help) with mac-style hover-to-switch
- Live system status cluster on the right:
  - Spotlight / Control Center / Bluetooth buttons
  - Battery percentage + animated charge state
  - Wi-Fi status (online / offline)
  - Volume button
  - Date and time clock (updates every second)
- Single-instance lock — only one bar at a time
- Survives display metric changes (resolution, scaling)

## Run

```bash
npm install
npm start
```

The bar appears at the top of your primary display and the OS will
reposition other maximized windows so they fit underneath it.

## Build a Windows installer

```bash
npm run build
```

Produces an NSIS installer and a portable `.exe` under `dist/`.

## Architecture

- `src/main.js` — Electron main process. Creates the borderless transparent
  always-on-top window, calls the AppBar module, exposes IPC handlers.
- `src/appbar.js` — Windows AppBar integration using `koffi`. Calls
  `SHAppBarMessage` with `ABM_NEW`, `ABM_QUERYPOS`, `ABM_SETPOS`,
  `ABM_REMOVE` to register the bar as an app bar docked to the top edge.
- `src/preload.js` — Context-isolated bridge between renderer and main.
- `src/renderer/index.html` + `styles.css` + `renderer.js` — The actual bar
  UI: menu items, dropdowns, clock, battery, status icons.

## How the AppBar trick works

Windows exposes a system-wide API (`SHAppBarMessage`) that lets any window
declare itself an "app bar" docked to one of the four screen edges. When a
window registers with `ABM_NEW` and posts its rectangle via `ABM_SETPOS`,
the Windows shell:

1. Subtracts that rectangle from the usable work area
2. Reflows other maximized windows so they don't overlap
3. Sends edge-change callbacks if the taskbar position changes

This is exactly the same mechanism the Windows taskbar itself uses. By
docking to `ABE_TOP`, we get the macOS-like behaviour: every other window
flows underneath our bar, and the bar never gets covered.

## Stack

- [Electron](https://www.electronjs.org/) (chromium + Node.js for the UI)
- [koffi](https://koffi.dev/) (C FFI for Node, used to call `shell32.dll!SHAppBarMessage`)
- [electron-builder](https://www.electron.build/) (NSIS / portable installer)

## License

MIT
