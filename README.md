<div align="center">

# ToolDock

**A polished native-like Windows utilities toolbox**

Built with Tauri v2 + React 19 + MUI v7

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-v2.0-24C8D8.svg)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg)](https://www.typescriptlang.org)

[English](README.md) | [简体中文](README_zh.md) | [Usage Guide](docs/USAGE_en.md)

</div>

---

## Highlights

- Material-like UI using MUI v7 (light/dark themes)
- High-performance native-feel using Tauri v2
- 29+ handy tools across Files, System, Network, Dev and Entertainment
- Built-in localization (i18n) with English & Chinese
- Granular permission model; sensitive actions require confirmation
- Small footprint and optimized memory usage
- Strong type-safety across frontend (TypeScript) and backend (Rust)

---

## Quickstart

### Requirements

| Component | Requirement                 |
| --------- | --------------------------- |
| Windows   | 10 / 11                     |
| Node.js   | v20+                        |
| pnpm      | Latest                      |
| Rust      | 1.70+ (with windows target) |

### Install dependencies

```bash
# clone repo
git clone https://github.com/yourusername/ToolDock.git
cd ToolDock

# install frontend dependencies
pnpm install
```

### Development

```bash
# start dev server with hot reload
pnpm tauri dev
```

### Build & Package

```bash
# build frontend assets
pnpm build

# package installers
pnpm tauri build

# output: src-tauri/target/release/bundle/
```

### Clear cache (PowerShell)

```powershell
Remove-Item -Path "$env:LOCALAPPDATA\tooldock" -Recurse -Force -ErrorAction SilentlyContinue

taskkill /F /IM ToolDock.exe 2>$null; pnpm tauri dev

cd src-tauri
cargo clean
cd ..
pnpm tauri dev
```

---

## Tools Overview

(Short summary; full list available inside the app)

### File Tools

- Folder Size — recursive disk analysis (treemap / table)
- Duplicate Finder — deduplicate by hash (MD5/SHA)
- Batch Renamer — regex, numbering, case conversion with preview
- Hash Calculator — file checksums (MD5/SHA1/SHA256)
- Image Converter — batch conversion and custom resolution

### System Tools

- Notepad — notes & Pomodoro-style tasks
- System Activator — activation helper for Windows/Office
- System Info — CPU, memory, disk stats and export
- Screen OCR — capture & extract text from screen
- Clicker — auto click / automation helper
- Clipboard Manager — history for text & images
- Magnifier — pixel-perfect zoom & color picker
- Floating Widgets — quick access shortcuts and small widgets

### Network Tools

- DNS Helper — DNS query & latency checks
- Nginx Editor — templates and syntax validation
- Port Scanner — TCP/UDP port scanning
- IP Lookup — IP geolocation and info
- Simple Web Server — quick static file hosting

### Dev Tools

- Node Manager — clean node_modules and caches
- AI Variable Naming — generate naming suggestions
- Unit Converter — currency, length, weight, temperature, bases
- Cron Generator — visual cron expression builder
- JSON Formatter — pretty-print, minify, tree view
- Encoders — Base64/URL/Hex/JWT and more
- Translator — multiple engines (Google/DeepL/Baidu/etc)
- Color Picker — pick and copy Hex/RGB/HSL
- QR Code — generate and scan
- Diff / Text Compare — highlight line-level differences
- Timestamp Converter — unix <-> human date/time

### Entertainment

- Games (2048 / Othello) — quick casual games with AI

---

## Usage Guide

For detailed usage and examples, see the full guide: `docs/USAGE_en.md`.

### Basic operations

1. Search tools using the top search bar
2. Favorite a tool by clicking the star on its card
3. Filter by category using the left sidebar
4. Switch theme in Settings (light/dark)
5. Configure global hotkey for quick access

### Permissions

- Admin privileges: editing system files like `hosts`, system-level Nginx configs
- File access: folder scans, batch rename
- Network: translation, port scanning, IP lookup
- Clipboard: clipboard history, OCR

Tauri will prompt permission dialogs when a tool first requires a capability.

---

## Development & Contributing

### Project layout

```
ToolDock/
├── src/                    # frontend
│   ├── pages/              # lazily-loaded pages
│   ├── components/         # shared components & layout
│   ├── tools/              # SSOT registry (tools/registry.ts)
│   ├── stores/             # Zustand stores
│   ├── hooks/              # custom hooks
│   ├── i18n/               # i18n locales
│   └── lib/                # Tauri API wrappers
├── src-tauri/              # backend (Rust)
│   ├── src/
│   │   ├── commands/       # Tauri commands
│   │   ├── core/           # pure core logic (no tauri deps)
│   │   ├── models/         # shared DTOs
│   │   └── errors.rs       # error types
│   └── capabilities/       # tauri capabilities config
└── docs/                   # docs & usage guides
```

### How to add a tool

Follow the workflow in `AGENTS.md` (Logic → I18n → Core Rust → Command → React UI). Add translations, register the tool in `tools/registry.ts`, and provide tests for core logic.

### Debug tips

```powershell
# clear app cache
Remove-Item -Path "$env:LOCALAPPDATA\tooldock" -Recurse -Force

# kill lingering process
taskkill /F /IM ToolDock.exe

# clean Rust build
cd src-tauri
cargo clean

# enable verbose backend logs
$env:RUST_LOG="debug"
pnpm tauri dev
```

---

## Contributing

Contributions are welcome. Please follow the commit conventions and open issues with reproduction steps and logs.

Suggested commit types: feat, fix, docs, style, refactor, perf, test

See `AGENTS.md` for architecture and coding guidelines.

---

## License

MIT License — see `LICENSE`.

---

## Thanks

Thanks to Tauri, MUI, Lucide and all contributors.

---

## Contact

- Issues: https://github.com/yourusername/ToolDock/issues
- Discussions: https://github.com/yourusername/ToolDock/discussions

---

<div align="center">
**If this project helps you, please give it a ⭐ on GitHub!**

Made by the ToolDock Team

</div>
