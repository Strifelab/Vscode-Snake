# Changelog

All notable changes to the **Snake** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
