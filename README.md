# Snake Game - VS Code Extension

A nostalgic Nokia 3310-style Snake game that runs in the VS Code Explorer sidebar. Features a retro green monochrome aesthetic, persistent leaderboard, special bonus food, and fully configurable game parameters.

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Entry Point](#entry-point)
- [Game Configuration](#game-configuration)
- [Game Mechanics](#game-mechanics)
- [Message API](#message-api)
- [Dependencies](#dependencies)
- [Build & Development](#build--development)
- [Packaging & Distribution](#packaging--distribution)

## Overview

This extension adds a Snake game panel to the VS Code Explorer sidebar. The game uses an HTML5 Canvas rendered inside a VS Code Webview, with score persistence via VS Code's global state storage.

**Key features:**

- Classic Snake gameplay with wrap-around (toroidal) movement
- Nokia 3310 retro color palette and pixelated rendering
- Normal food (+1 point) and time-limited special food (+5 points)
- Progressive speed increase as the snake grows
- Persistent top-10 leaderboard across VS Code sessions
- Fully parameterizable game settings via a `CONFIG` object
- Optional grid border display
- Italian UI language

## Project Structure

```
├── src/
│   ├── extension.ts            # Extension entry point (activation)
│   ├── snakeViewProvider.ts     # Webview provider (HTML generation + message routing)
│   └── leaderboard.ts          # Score storage and retrieval (VS Code global state)
├── media/
│   ├── game.js                 # Complete game logic (rendering, input, game loop)
│   └── game.css                # Retro Nokia 3310 styling
├── dist/
│   └── extension.js            # Compiled and bundled output
├── .vscode/
│   └── launch.json             # VS Code debug configuration
├── package.json                # Extension manifest, scripts, and metadata
├── tsconfig.json               # TypeScript compiler configuration
├── esbuild.js                  # ESBuild bundler configuration
└── LICENSE.md                  # License file
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
│                        └── Routes messages       │
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
│  game.css ─► Retro Nokia 3310 styling            │
└──────────────────────────────────────────────────┘
```

1. **Extension Host** (`src/`): TypeScript code that runs in the VS Code Node.js process. Handles activation, webview creation, and data persistence.
2. **Webview** (`media/`): Plain JavaScript and CSS running in an isolated browser context inside VS Code. Handles all game logic and rendering.
3. **Communication**: The two layers communicate via `postMessage` / `onDidReceiveMessage` for leaderboard operations.

## Entry Point

### Activation (`src/extension.ts`)

The extension activates automatically when VS Code loads (no explicit activation events). It registers a `WebviewViewProvider` for the view ID `snakeGame.gameView`, which is declared in `package.json` under `contributes.views.explorer`.

### View Registration (`package.json`)

```json
{
  "contributes": {
    "views": {
      "explorer": [
        {
          "type": "webview",
          "id": "snakeGame.gameView",
          "name": "Snake Game"
        }
      ]
    }
  }
}
```

This places the Snake Game panel in the Explorer sidebar. The `retainContextWhenHidden` option keeps the game state alive even when the panel is not visible.

## Game Configuration

All game parameters are centralized in the `CONFIG` object at the top of `media/game.js`. Modify these values to customize the game:

### Grid & Canvas

| Parameter | Default | Description |
|-----------|---------|-------------|
| `gridWidth` | `10` | Number of horizontal cells |
| `gridHeight` | `10` | Number of vertical cells |
| `maxCanvasHeight` | `320` | Maximum canvas height in pixels |

### Snake Dimensions

| Parameter | Default | Description |
|-----------|---------|-------------|
| `snakeHeadInset` | `0.10` | Head size reduction per side (10%) |
| `snakeBodyInset` | `0.08` | Body size reduction per side (8%) |

### Element Spacing

| Parameter | Default | Description |
|-----------|---------|-------------|
| `foodInset` | `0.20` | Normal food size reduction per side (20%) |

### Scoring

| Parameter | Default | Description |
|-----------|---------|-------------|
| `baseScore` | `1` | Points for eating normal food |
| `specialScore` | `5` | Points for eating special food |

### Speed

| Parameter | Default | Description |
|-----------|---------|-------------|
| `baseSpeed` | `160` | Initial game loop interval in ms (higher = slower) |
| `speedStep` | `5` | Interval reduction per extra snake segment |
| `minSpeed` | `70` | Minimum interval in ms (maximum speed cap) |

The speed formula: `speed = max(minSpeed, baseSpeed - (snakeLength - 3) * speedStep)`

### Special Food

| Parameter | Default | Description |
|-----------|---------|-------------|
| `specialFoodChance` | `0.15` | Spawn probability after eating (15%) |
| `specialFoodDuration` | `20` | Lifetime in game ticks |

### Grid Borders

| Parameter | Default | Description |
|-----------|---------|-------------|
| `showGridBorders` | `false` | Toggle grid line visibility |
| `gridBorderColor` | `#306230` | Color of grid lines |

### Colors (Nokia 3310 Palette)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `colors.bg` | `#8bac0f` | Canvas background (light green) |
| `colors.snake` | `#0f380f` | Snake body (dark green) |
| `colors.snakeHead` | `#0f380f` | Snake head (dark green) |
| `colors.food` | `#306230` | Normal food (medium green) |
| `colors.specialFood` | `#0f380f` | Special food primary (dark green) |
| `colors.specialFoodAlt` | `#9bbc0f` | Special food blink (light green) |
| `colors.text` | `#0f380f` | General text (dark green) |
| `colors.gameOver` | `#0f380f` | Game over text (dark green) |
| `colors.eyes` | `#8bac0f` | Snake eyes (matches background) |

## Game Mechanics

### Movement
- The snake moves continuously in the current direction
- Supports Arrow keys and WASD controls
- Direction is buffered to prevent 180-degree reversals within a single tick
- The grid wraps around (toroidal): exiting one edge enters the opposite

### Growth & Collision
- Eating food causes the snake to grow by one segment (tail is not removed)
- Colliding with the snake's own body ends the game
- There is no wall collision (wrap-around movement)

### Food System
- **Normal food**: Always present on the grid. Awards `baseScore` points
- **Special food**: 15% chance to spawn after eating normal food. Awards `specialScore` points. Appears as a blinking diamond and disappears after `specialFoodDuration` ticks

### Speed Progression
- Speed increases each time the snake eats (the game loop interval decreases)
- The increase is proportional to the snake length, with a minimum interval cap

### Scoring & Leaderboard
- After game over, a 1200ms delay shows the result on canvas
- Then an overlay prompts for a player name (max 6 characters, auto-uppercase)
- Scores are persisted in VS Code's global state (survives restarts)
- Top 10 scores are kept, sorted by score descending

## Message API

Communication between the Webview (game.js) and the Extension Host (snakeViewProvider.ts) uses VS Code's `postMessage` protocol:

### Webview → Extension Host

| Message Type | Payload | Description |
|---|---|---|
| `saveScore` | `{ score: number, name: string }` | Save a score to the leaderboard |
| `getLeaderboard` | _(none)_ | Request leaderboard data |

### Extension Host → Webview

| Message Type | Payload | Description |
|---|---|---|
| `scoreSaved` | _(none)_ | Confirms score was saved |
| `leaderboardData` | `{ entries: LeaderboardEntry[] }` | Leaderboard data response |

### LeaderboardEntry Interface

```typescript
interface LeaderboardEntry {
    score: number;   // Player score
    name: string;    // Player name (max 6 chars)
    date: string;    // ISO 8601 timestamp
}
```

## Dependencies

### Runtime
- **VS Code API** (`vscode ^1.85.0`): Webview, global state storage, extension lifecycle

### Development
| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | `^5.7.0` | TypeScript compiler |
| `esbuild` | `^0.25.0` | Fast JavaScript bundler |
| `@types/vscode` | `^1.85.0` | VS Code API type definitions |
| `@vscode/vsce` | `^3.0.0` | Extension packaging tool |
| `npm-run-all` | `^4.1.5` | Parallel npm script runner |

No runtime dependencies are required beyond the VS Code API. The game logic is pure vanilla JavaScript with no external libraries.

## Build & Development

### Prerequisites
- Node.js (LTS recommended)
- npm

### Install Dependencies

```bash
npm install
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Type-check and build with esbuild |
| `npm run watch` | Watch mode (auto-rebuild on changes) |
| `npm run check-types` | TypeScript type checking only |
| `npm run package` | Production build (minified) |
| `npm run build-vsix` | Build distributable `.vsix` package |

### Development Workflow

1. Run `npm run watch` to start the watcher
2. Press `F5` in VS Code to launch the Extension Development Host
3. The Snake Game panel appears in the Explorer sidebar
4. Changes to `media/game.js` and `media/game.css` are reflected after reloading the webview
5. Changes to `src/*.ts` require restarting the Extension Development Host

### Debugging

The `.vscode/launch.json` is pre-configured for debugging. Press `F5` to:
1. Compile the extension
2. Launch a new VS Code window with the extension loaded
3. Set breakpoints in TypeScript files for the extension host
4. Use the browser DevTools (Help > Toggle Developer Tools) for webview debugging

## Packaging & Distribution

Build a `.vsix` package for distribution:

```bash
npm run build-vsix
```

Install the generated `.vsix` file:

```bash
code --install-extension snake-0.5.0.vsix
```

Or install via VS Code: Extensions panel > `...` menu > "Install from VSIX..."
