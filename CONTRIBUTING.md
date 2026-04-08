# Contributing to Snake for VS Code

Thank you for your interest in contributing! This document covers the technical architecture, codebase structure, and development workflow.

## Table of Contents

- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Entry Point](#entry-point)
- [Game Configuration](#game-configuration)
- [Game Mechanics](#game-mechanics)
- [Settings System](#settings-system)
- [Internationalization (i18n)](#internationalization-i18n)
- [Message API](#message-api)
- [Scoring & Leaderboard](#scoring--leaderboard)
- [Dependencies](#dependencies)
- [Build & Development](#build--development)
- [Packaging & Distribution](#packaging--distribution)

## Project Structure

```
├── src/
│   ├── extension.ts            # Extension entry point (activation)
│   ├── snakeViewProvider.ts     # Webview provider (HTML generation + message routing)
│   └── leaderboard.ts          # Score storage and retrieval (VS Code global state)
├── media/
│   ├── game.js                 # Complete game logic (rendering, input, game loop)
│   ├── game.css                # Retro Nokia 3310 styling
│   ├── icon.png                # Extension icon (marketplace + README)
│   ├── icon.svg                # Extension icon (SVG source)
│   └── i18n/                   # Internationalization files
│       ├── config.js           # i18n configuration and language registry
│       ├── en.js               # English
│       ├── it.js               # Italian
│       ├── fr.js               # French
│       ├── es.js               # Spanish
│       ├── de.js               # German
│       ├── pt.js               # Portuguese
│       ├── zh.js               # Chinese
│       ├── ja.js               # Japanese
│       ├── ko.js               # Korean
│       ├── ru.js               # Russian
│       └── hi.js               # Hindi
├── dist/
│   └── extension.js            # Compiled and bundled output
├── .vscode/
│   └── launch.json             # VS Code debug configuration
├── package.json                # Extension manifest, scripts, and metadata
├── tsconfig.json               # TypeScript compiler configuration
├── esbuild.js                  # ESBuild bundler configuration
└── LICENSE                     # MIT License
```

## Architecture

The extension follows a standard VS Code Webview architecture with three layers:

```
┌─────────────────────────────────────────────────┐
│                  VS Code Host                    │
│                                                  │
│  extension.ts ──► snakeViewProvider.ts           │
│                        │                         │
│                        ├── Generates HTML/CSS/JS │
│                        ├── Routes messages       │
│                        └── Manages settings      │
│                             │                    │
│                   leaderboard.ts                 │
│                   (globalState read/write)        │
└────────────────────┬────────────────────────────┘
                     │ postMessage API
┌────────────────────▼────────────────────────────┐
│                  Webview (Browser)                │
│                                                  │
│  game.js ──► Canvas rendering                    │
│          ──► Game loop                           │
│          ──► Keyboard input handling             │
│          ──► Settings UI                         │
│  game.css ─► Retro Nokia 3310 styling            │
│  i18n/   ──► Translation strings                 │
└──────────────────────────────────────────────────┘
```

1. **Extension Host** (`src/`): TypeScript code running in the VS Code Node.js process. Handles activation, webview creation, data persistence, and settings management.
2. **Webview** (`media/`): Plain JavaScript and CSS running in an isolated browser context inside VS Code. Handles all game logic, rendering, input, and UI.
3. **Communication**: The two layers communicate via `postMessage` / `onDidReceiveMessage` for leaderboard and settings operations.

## Entry Point

### Activation (`src/extension.ts`)

The extension activates automatically when VS Code loads (implicit activation via the view contribution). It registers a `WebviewViewProvider` for the view ID `snakeGame.gameView`, declared in `package.json` under `contributes.views.explorer`.

### View Registration (`package.json`)

```json
{
  "contributes": {
    "views": {
      "explorer": [
        {
          "type": "webview",
          "id": "snakeGame.gameView",
          "name": "Snake",
          "initialSize": 450
        }
      ]
    }
  }
}
```

This places the Snake panel in the Explorer sidebar. The webview has scripts enabled and resource access restricted to the `media/` folder via `localResourceRoots`.

## Game Configuration

All game parameters are centralized in the `CONFIG` object at the top of `media/game.js`:

### Grid & Canvas

| Parameter         | Default | Description                     |
| ----------------- | ------- | ------------------------------- |
| `gridWidth`       | `20`    | Number of horizontal cells      |
| `gridHeight`      | `20`    | Number of vertical cells        |
| `maxCanvasHeight` | `320`   | Maximum canvas height in pixels |

### Snake Dimensions

| Parameter        | Default | Description                        |
| ---------------- | ------- | ---------------------------------- |
| `snakeHeadInset` | `0.10`  | Head size reduction per side (10%) |
| `snakeBodyInset` | `0.12`  | Body size reduction per side (12%) |

### Element Spacing

| Parameter   | Default | Description                               |
| ----------- | ------- | ----------------------------------------- |
| `foodInset` | `0.20`  | Normal food size reduction per side (20%) |

### Scoring

| Parameter      | Default | Description                    |
| -------------- | ------- | ------------------------------ |
| `baseScore`    | `1`     | Points for eating normal food  |
| `specialScore` | `5`     | Points for eating special food |

### Speed

| Parameter   | Default | Description                                 |
| ----------- | ------- | ------------------------------------------- |
| `gameSpeed` | `5`     | Speed level 1–10 (configurable in settings) |
| `speedStep` | `3`     | Interval reduction per extra snake segment  |

Speed is mapped to a base interval via the `SPEED_INTERVALS` array:

```
Level:    1    2    3    4    5    6    7    8    9    10
Interval: 500  450  400  350  300  250  200  150  100  50  (ms)
```

As the snake grows, the interval decreases further by `speedStep` ms per segment, with an absolute minimum of 25ms.

### Special Food

| Parameter             | Default | Description                          |
| --------------------- | ------- | ------------------------------------ |
| `specialFoodChance`   | `0.15`  | Spawn probability after eating (15%) |
| `specialFoodDuration` | `35`    | Lifetime in game ticks               |

### Grid Borders

| Parameter         | Default   | Description                 |
| ----------------- | --------- | --------------------------- |
| `showGridBorders` | `true`    | Toggle grid line visibility |
| `gridBorderColor` | `#306230` | Color of grid lines         |

### Colors (Nokia 3310 Palette)

| Parameter               | Default   | Description                                |
| ----------------------- | --------- | ------------------------------------------ |
| `colors.bg`             | `#8bac0f` | Canvas background (light green)            |
| `colors.snake`          | `#0f380f` | Snake body (dark green)                    |
| `colors.snakeHead`      | `#0f380f` | Snake head (dark green)                    |
| `colors.food`           | `#306230` | Normal food (medium green)                 |
| `colors.specialFood`    | `#0f380f` | Special food primary (dark green)          |
| `colors.specialFoodAlt` | `#9bbc0f` | Special food blink alternate (light green) |
| `colors.text`           | `#0f380f` | General text (dark green)                  |
| `colors.gameOver`       | `#0f380f` | Game over text (dark green)                |
| `colors.eyes`           | `#8bac0f` | Snake eyes (matches background)            |

## Game Mechanics

### Movement

- The snake moves continuously in the current direction
- Supports Arrow keys and WASD controls
- A direction buffer prevents 180-degree reversals within a single tick
- The grid wraps around (toroidal): exiting one edge enters the opposite

### Growth & Collision

- Eating food causes the snake to grow by one segment (tail is not removed that tick)
- Colliding with the snake's own body triggers Game Over
- There is no wall collision (wrap-around movement)

### Food System

- **Normal food**: Always present on the grid. Awards `baseScore` points (1)
- **Special food**: 15% chance to spawn after eating normal food. Awards `specialScore` points (5). Appears as a blinking diamond shape and disappears after `specialFoodDuration` ticks (35)

### Speed Progression

- Base speed is determined by the `gameSpeed` setting (level 1–10)
- Speed increases as the snake grows: interval decreases by `speedStep` ms per segment beyond the initial 3
- Absolute minimum interval: 25ms

### Pause System

- The game auto-pauses when the webview loses focus (blur event) or the document becomes hidden (visibility change)
- A pause overlay appears with a "Click here to resume" message
- Clicking the overlay resumes gameplay

### Game Over Flow

1. Collision detected → game loop stops
2. 1200ms delay to show the final state on canvas
3. Name input overlay appears (max 6 characters, auto-uppercased)
4. Player submits name → score saved via `postMessage` → leaderboard opens

### Snake Eyes

The snake head has two eyes drawn as small circles. The eye positions shift based on the current direction, giving the snake a "looking ahead" effect.

## Settings System

Settings are persisted in VS Code's `globalState` under the key `snakeGame.settings`:

```typescript
interface GameSettings {
  language: string; // Language code (e.g., 'en', 'it', 'fr')
  showGridBorders: boolean; // Grid lines on/off
  speed: number; // Speed level 1–10
}
```

**Default values:**

- `language`: auto-detected from `vscode.env.language`, fallback to `'en'`
- `showGridBorders`: `true`
- `speed`: `5`

The settings page in the webview includes:

- A language dropdown (populated from the i18n registry)
- A speed slider (range 1–10)
- A grid toggle button (ON/OFF)

Changes are sent to the extension host via `saveSettings` and persisted immediately.

## Internationalization (i18n)

### Supported Languages

| Code | Language  |
| ---- | --------- |
| `en` | English   |
| `fr` | Français  |
| `es` | Español   |
| `it` | Italiano  |
| `de` | Deutsch   |
| `pt` | Português |
| `zh` | 中文      |
| `ja` | 日本語    |
| `ko` | 한국어    |
| `ru` | Русский   |
| `hi` | हिन्दी    |

### How it Works

1. `media/i18n/config.js` defines the `I18N` global object and the language registry
2. Each language file (e.g., `en.js`) adds its translations to `I18N['en']`
3. The `t(key)` function in `game.js` looks up the current language's translation, falling back to the key itself
4. Language is auto-detected from `vscode.env.language` on first run

### Adding a New Language

1. Create `media/i18n/<code>.js` following the structure of any existing language file
2. Add the language code to `SUPPORTED_LANGUAGES` in `src/snakeViewProvider.ts`
3. Add the `<script>` tag in the HTML template in `snakeViewProvider.ts`
4. Add the language to the i18n config registry in `media/i18n/config.js`

## Message API

Communication between the Webview (`game.js`) and the Extension Host (`snakeViewProvider.ts`) uses VS Code's `postMessage` protocol:

### Webview → Extension Host

| Message Type     | Payload                           | Description                     |
| ---------------- | --------------------------------- | ------------------------------- |
| `saveScore`      | `{ score: number, name: string }` | Save a score to the leaderboard |
| `getLeaderboard` | _(none)_                          | Request leaderboard data        |
| `getSettings`    | _(none)_                          | Request current settings        |
| `saveSettings`   | `{ settings: GameSettings }`      | Persist updated settings        |

### Extension Host → Webview

| Message Type      | Payload                           | Description                  |
| ----------------- | --------------------------------- | ---------------------------- |
| `scoreSaved`      | _(none)_                          | Confirms score was saved     |
| `leaderboardData` | `{ entries: LeaderboardEntry[] }` | Leaderboard data response    |
| `settingsData`    | `{ settings: GameSettings }`      | Current settings response    |
| `settingsSaved`   | _(none)_                          | Confirms settings were saved |

### Data Interfaces

```typescript
interface LeaderboardEntry {
  score: number; // Player score
  name: string; // Player name (max 6 chars)
  date: string; // ISO 8601 timestamp
}

interface GameSettings {
  language: string;
  showGridBorders: boolean;
  speed: number;
}
```

## Scoring & Leaderboard

- Leaderboard is stored in VS Code's `globalState` under key `snakeGame.leaderboard`
- Persists across editor restarts: shared across all VS Code windows for the same user
- Top 10 entries, sorted by score descending
- Each entry: `{ score, name (max 6 chars), date (ISO 8601) }`
- The leaderboard table displays: rank (#), name, points, and date (formatted in the user's locale)

## Dependencies

### Runtime

- **VS Code API** (`vscode ^1.85.0`): Webview, global state storage, extension lifecycle

No runtime dependencies are required beyond the VS Code API. The game logic is pure vanilla JavaScript with no external libraries.

### Development

| Package         | Version   | Purpose                      |
| --------------- | --------- | ---------------------------- |
| `typescript`    | `^5.7.0`  | TypeScript compiler          |
| `esbuild`       | `^0.25.0` | Fast JavaScript bundler      |
| `@types/vscode` | `^1.85.0` | VS Code API type definitions |
| `@vscode/vsce`  | `^3.0.0`  | Extension packaging tool     |
| `npm-run-all`   | `^4.1.5`  | Parallel npm script runner   |

## Build & Development

### Prerequisites

- Node.js (LTS recommended)
- npm

### Install Dependencies

```bash
npm install
```

### Available Scripts

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `npm run compile`     | Type-check and build with esbuild    |
| `npm run watch`       | Watch mode (auto-rebuild on changes) |
| `npm run check-types` | TypeScript type checking only        |
| `npm run package`     | Production build (minified)          |
| `npm run build-vsix`  | Build distributable `.vsix` package  |

### Development Workflow

1. Run `npm run watch` to start the watcher
2. Press `F5` in VS Code to launch the Extension Development Host
3. The Snake panel appears in the Explorer sidebar
4. Changes to `media/game.js` and `media/game.css` are reflected after reloading the webview
5. Changes to `src/*.ts` require restarting the Extension Development Host

### Debugging

The `.vscode/launch.json` is pre-configured for debugging. Press `F5` to:

1. Compile the extension
2. Launch a new VS Code window with the extension loaded
3. Set breakpoints in TypeScript files for the extension host
4. Use the browser DevTools (`Help > Toggle Developer Tools`) for webview debugging

## Packaging & Distribution

Build a `.vsix` package for distribution:

```bash
npm run build-vsix
```

This runs type-checking, production build (minified), and `vsce package` in sequence.

Install the generated `.vsix` file:

```bash
code --install-extension snake-1.0.0.vsix
```

Or install via VS Code: Extensions panel > `...` menu > "Install from VSIX..."

To publish to the VS Code Marketplace:

```bash
vsce publish
```

Requires a Personal Access Token (PAT) configured for the `Strifelab` publisher. See [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) for details.
