# Changelog

All notable changes to the **Snake** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-04-16

### Changed

- Replaced the interval-based game loop with a requestAnimationFrame fixed-timestep loop for smoother timing and adaptive tick intervals
- Added a layered rendering setup with a static background canvas and canvas wrapper so the grid is redrawn only when needed while snake and food stay on the foreground canvas
- Introduced an input queue and pressed-key tracking to buffer rapid direction changes and avoid key-repeat and 180° reversal issues
- Updated resize handling to refresh both canvases and redraw the background, and made the grid toggle force a background refresh
- Removed legacy setInterval usage, added RAF start/stop helpers, cleared key state on pause and finish, and improved focus handling
- Updated CSS for the wrapper and layered canvases, and changed UI display toggles to hide the wrapper instead of the single canvas

## [1.0.0] - 2026-04-08

### Added

- Classic Snake gameplay with wrap-around (toroidal) movement - no walls, just like the original Nokia 3310
- Authentic Nokia 3310 green monochrome aesthetic with pixelated canvas rendering
- Snake eyes that follow the current direction of movement
- Normal food (+1 point) always present on the grid
- Special diamond-shaped bonus food (+5 points) with 15% spawn chance and limited lifetime (35 ticks)
- 10 speed levels with progressive acceleration as the snake grows
- Persistent top-10 leaderboard saved across VS Code sessions via global state
- Game Over overlay with player name input (max 6 characters, auto-uppercase)
- In-game settings page: language selector, speed slider (1–10), grid border toggle
- Auto-pause when the editor loses focus or the tab becomes hidden
- Support for 11 languages with automatic detection from VS Code locale:
  English, Français, Español, Italiano, Deutsch, Português, 中文, 日本語, 한국어, Русский, हिन्दी
- Arrow keys and WASD controls with direction buffer to prevent 180° reversals
- Idle screen with "SNAKE" title when no game is running
- Secure webview with Content Security Policy (CSP) and nonce-based script loading

[1.0.0]: https://github.com/Strifelab/Vscode-Snake/releases/tag/v1.0.0
[1.1.0]: https://github.com/Strifelab/Vscode-Snake/releases/tag/v1.1.0
