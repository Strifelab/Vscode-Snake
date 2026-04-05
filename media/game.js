/**
 * ============================================================================
 * SNAKE GAME - Main game logic
 * ============================================================================
 * This file contains all the Snake game logic, including:
 * - Parameterizable configuration (CONFIG object)
 * - Canvas management and graphic rendering
 * - Game loop and mechanics (movement, collisions, scoring)
 * - Keyboard input handling
 * - Communication with the VS Code extension (leaderboard)
 * ============================================================================
 */
(function () {

    // =========================================================================
    // CONFIGURATION - Modify these values to customize the game
    // =========================================================================
    const CONFIG = {
        // -- Grid dimensions --
        gridWidth: 20,              // Grid width (number of horizontal cells)
        gridHeight: 20,             // Grid height (number of vertical cells)
        maxCanvasHeight: 320,       // Maximum canvas height in pixels

        // -- Snake dimensions --
        snakeHeadInset: 0.1,       // Cell inset for the head (0.10 = 10% per side)
        snakeBodyInset: 0.12,       // Cell inset for the body (0.08 = 8% per side)

        // -- Element spacing --
        foodInset: 0.20,            // Cell inset for normal food (0.20 = 20% per side)

        // -- Scoring --
        baseScore: 1,               // Points earned by eating normal food
        specialScore: 5,            // Points earned by eating special food

        // -- Speed --
        baseSpeed: 90,             // Initial game loop interval in milliseconds (higher = slower)
        speedStep: 3,              // Interval reduction for each additional snake segment
        minSpeed: 75,               // Minimum interval in ms (maximum reachable speed)

        // -- Special food --
        specialFoodChance: 0.15,    // Probability of special food spawning after eating (0.15 = 15%)
        specialFoodDuration: 35,    // Special food duration in ticks before disappearing

        // -- Grid borders --
        showGridBorders: true,      // If true, shows grid lines on the canvas
        gridBorderColor: '#306230', // Grid line color

        // -- Colors (Nokia 3310 palette) --
        colors: {
            bg: '#8bac0f',              // Canvas background (light green)
            snake: '#0f380f',           // Snake body color (dark green)
            snakeHead: '#0f380f',       // Snake head color (dark green)
            food: '#306230',            // Normal food color (medium green)
            specialFood: '#0f380f',     // Special food primary color (dark green)
            specialFoodAlt: '#9bbc0f',  // Special food alternate color (for blinking)
            text: '#0f380f',            // Generic text color (dark green)
            gameOver: '#0f380f',        // Game over text color
            eyes: '#8bac0f',            // Snake eye color (light green, same as background)
        },
    };

    // =========================================================================
    // i18n - Internationalization
    // =========================================================================

    let currentLang = 'it';

    function t(key) {
        if (typeof I18N !== 'undefined' && I18N[currentLang] && I18N[currentLang][key]) {
            return I18N[currentLang][key];
        }
        return key;
    }

    // =========================================================================
    // INITIALIZATION - VS Code API acquisition and DOM references
    // =========================================================================

    /** VS Code API for communicating with the host extension */
    const vscode = acquireVsCodeApi();

    /** HTML canvas element where the game is drawn */
    const canvas = document.getElementById('gameCanvas');

    /** Canvas 2D rendering context */
    const ctx = canvas.getContext('2d');

    /** Element displaying the current score */
    const scoreDisplay = document.getElementById('score-display');

    /** Button to start/restart the game */
    const startBtn = document.getElementById('startBtn');

    /** Button to stop the current game */
    const stopBtn = document.getElementById('stopBtn');

    /** Button to open the leaderboard */
    const leaderboardBtn = document.getElementById('leaderboardBtn');

    /** Leaderboard container */
    const leaderboardDiv = document.getElementById('leaderboard');

    /** Leaderboard table body */
    const leaderboardBody = document.querySelector('#leaderboard-table tbody');

    /** Button to go back from the leaderboard */
    const backBtn = document.getElementById('backBtn');

    /** Overlay for name input at game over */
    const nameOverlay = document.getElementById('name-overlay');

    /** Overlay title (e.g. "GAME OVER") */
    const nameOverlayTitle = document.getElementById('name-overlay-title');

    /** Score displayed in the overlay */
    const nameOverlayScore = document.getElementById('name-overlay-score');

    /** Player name input field */
    const nameInput = document.getElementById('nameInput');

    /** Button to save the score with the name */
    const nameSaveBtn = document.getElementById('nameSaveBtn');

    /** Settings page elements */
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPage = document.getElementById('settings-page');
    const settingsTitle = document.getElementById('settings-title');
    const settingsLangLabel = document.getElementById('settings-lang-label');
    const settingsGridLabel = document.getElementById('settings-grid-label');
    const langSelect = document.getElementById('langSelect');
    const gridToggleBtn = document.getElementById('gridToggleBtn');
    const settingsBackBtn = document.getElementById('settingsBackBtn');

    // =========================================================================
    // GAME STATE VARIABLES
    // =========================================================================

    /** Cell size in pixels (dynamically recalculated on resize) */
    let CELL_SIZE = 10;

    /** Array of snake segments, each element is an {x, y} object */
    let snake = [];

    /** Current movement direction {x, y} where values are -1, 0 or 1 */
    let direction = { x: 1, y: 0 };

    /** Buffered direction from the player (applied on next tick) */
    let nextDirection = { x: 1, y: 0 };

    /** Normal food position {x, y} or null if not present */
    let food = null;

    /** Special food position {x, y} or null if not present */
    let specialFood = null;

    /** Special food timer: counts remaining ticks before disappearing */
    let specialFoodTimer = 0;

    /** Current game score */
    let score = 0;

    /** Flag indicating whether the game is running */
    let gameRunning = false;

    /** Reference to the game loop interval (for clearInterval) */
    let gameInterval = null;

    /** Total tick counter (used for animations) */
    let tickCount = 0;

    /** Flag indicating whether the leaderboard is currently displayed */
    let showingLeaderboard = false;

    /** Flag indicating whether the settings page is currently displayed */
    let showingSettings = false;

    /** Flag indicating whether at least one game has been played (for button text) */
    let hasPlayed = false;

    /** Score pending save (stored at game over) */
    let pendingScore = 0;

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    /**
     * Calculates the current game speed based on snake length.
     * The longer the snake, the faster the game (reduced interval).
     * Speed never drops below CONFIG.minSpeed.
     * @returns {number} Interval in milliseconds for the game loop
     */
    function getSpeed() {
        const extra = Math.max(0, snake.length - 3);
        return Math.max(CONFIG.minSpeed, CONFIG.baseSpeed - extra * CONFIG.speedStep);
    }

    /**
     * Restarts the game loop interval with the current speed.
     * Called every time the snake eats to update the speed.
     */
    function restartInterval() {
        if (gameInterval) {
            clearInterval(gameInterval);
        }
        gameInterval = setInterval(gameLoop, getSpeed());
    }

    // =========================================================================
    // CANVAS MANAGEMENT AND RESIZING
    // =========================================================================

    /**
     * Resizes the canvas based on the container width.
     * Calculates optimal cell size while keeping the canvas
     * within maximum height limits. Redraws the idle state if the
     * game is not running.
     */
    function resizeCanvas() {
        const containerWidth = document.body.clientWidth - 8;
        CELL_SIZE = Math.max(12, Math.floor(containerWidth / CONFIG.gridWidth));

        // Limit cell size to not exceed maximum height
        if (CELL_SIZE * CONFIG.gridHeight > CONFIG.maxCanvasHeight) {
            CELL_SIZE = Math.floor(CONFIG.maxCanvasHeight / CONFIG.gridHeight);
        }

        canvas.width = CELL_SIZE * CONFIG.gridWidth;
        canvas.height = CELL_SIZE * CONFIG.gridHeight;

        if (!gameRunning) {
            drawIdle();
        }
    }

    /**
     * Draws the initial screen (idle state) with the "SNAKE" title
     * and the message to start the game.
     */
    function drawIdle() {
        // Background
        ctx.fillStyle = CONFIG.colors.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // "SNAKE" title
        ctx.fillStyle = CONFIG.colors.text;
        ctx.font = `bold ${Math.floor(CELL_SIZE * 0.9)}px "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SNAKE', canvas.width / 2, canvas.height / 2 - CELL_SIZE);

        // Start message
        ctx.font = `${Math.floor(CELL_SIZE * 0.55)}px "Courier New", monospace`;
        ctx.fillText(t('pressStart'), canvas.width / 2, canvas.height / 2 + CELL_SIZE);
    }

    // =========================================================================
    // GAME INITIALIZATION
    // =========================================================================

    /**
     * Initializes the game state for a new match.
     * Places the snake at the center of the grid with 3 segments,
     * resets score, direction, timer and spawns the first food.
     */
    function initGame() {
        const midX = Math.floor(CONFIG.gridWidth / 2);
        const midY = Math.floor(CONFIG.gridHeight / 2);

        // The snake starts at the center with 3 segments going left
        snake = [
            { x: midX, y: midY },
            { x: midX - 1, y: midY },
            { x: midX - 2, y: midY },
        ];

        direction = { x: 1, y: 0 };       // Initial direction: right
        nextDirection = { x: 1, y: 0 };
        score = 0;
        specialFood = null;
        specialFoodTimer = 0;
        tickCount = 0;
        food = spawnFood();
        updateScore();
    }

    // =========================================================================
    // FOOD MANAGEMENT
    // =========================================================================

    /**
     * Generates a new random position for normal food.
     * The position cannot overlap with the snake or special food.
     * @returns {{x: number, y: number}} Position of the new food
     */
    function spawnFood() {
        let pos;
        do {
            pos = {
                x: Math.floor(Math.random() * CONFIG.gridWidth),
                y: Math.floor(Math.random() * CONFIG.gridHeight),
            };
        } while (
            snake.some(s => s.x === pos.x && s.y === pos.y) ||
            (specialFood && specialFood.x === pos.x && specialFood.y === pos.y)
        );
        return pos;
    }

    /**
     * Spawns special food at a random position.
     * Cannot overlap with the snake or normal food.
     * Sets the duration timer based on the configuration.
     */
    function spawnSpecialFood() {
        let pos;
        do {
            pos = {
                x: Math.floor(Math.random() * CONFIG.gridWidth),
                y: Math.floor(Math.random() * CONFIG.gridHeight),
            };
        } while (
            snake.some(s => s.x === pos.x && s.y === pos.y) ||
            (food && food.x === pos.x && food.y === pos.y)
        );
        specialFood = pos;
        specialFoodTimer = CONFIG.specialFoodDuration;
    }

    // =========================================================================
    // SCORING
    // =========================================================================

    /**
     * Updates the score display in the UI.
     */
    function updateScore() {
        scoreDisplay.textContent = t('score') + ': ' + score;
    }

    // =========================================================================
    // GAME LOOP - Main game cycle
    // =========================================================================

    /**
     * Main game loop function, executed at regular intervals.
     * On each tick:
     * 1. Applies the buffered direction from the player
     * 2. Calculates the new head position (with border wrapping)
     * 3. Checks for self-collision (game over)
     * 4. Checks if the snake ate normal or special food
     * 5. Manages snake growth and the special food timer
     * 6. Updates speed if needed and redraws the canvas
     */
    function gameLoop() {
        tickCount++;

        // Apply the buffered direction from player input
        direction = { ...nextDirection };

        // Calculate the new head position with toroidal wrapping
        // (the snake reappears from the opposite side when exiting the grid)
        let newHead = {
            x: (snake[0].x + direction.x + CONFIG.gridWidth) % CONFIG.gridWidth,
            y: (snake[0].y + direction.y + CONFIG.gridHeight) % CONFIG.gridHeight,
        };

        // Check collision with own body -> game over
        if (snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
            finishGame(t('gameOver'));
            return;
        }

        // Insert the new head at the top of the snake array
        snake.unshift(newHead);

        let ate = false;

        // Check if the head reached the normal food
        if (food && newHead.x === food.x && newHead.y === food.y) {
            score += CONFIG.baseScore;
            ate = true;
            food = spawnFood();

            // Chance to spawn special food (only if there isn't one already)
            if (!specialFood && Math.random() < CONFIG.specialFoodChance) {
                spawnSpecialFood();
            }
        }

        // Check if the head reached the special food
        if (specialFood && newHead.x === specialFood.x && newHead.y === specialFood.y) {
            score += CONFIG.specialScore;
            ate = true;
            specialFood = null;
            specialFoodTimer = 0;
        }

        // If the snake didn't eat, remove the tail (no growth)
        // If it ate, the tail stays (snake grows by one segment)
        if (!ate) {
            snake.pop();
        } else {
            // Update game speed after eating
            restartInterval();
        }

        // Handle special food countdown
        if (specialFood) {
            specialFoodTimer--;
            if (specialFoodTimer <= 0) {
                specialFood = null;
            }
        }

        updateScore();
        draw();
    }

    // =========================================================================
    // RENDERING - Drawing the game on the canvas
    // =========================================================================

    /**
     * Draws the entire game state on the canvas:
     * - Background and optional grid
     * - Normal food (reduced square)
     * - Special food (blinking diamond)
     * - Snake (head with eyes + body)
     */
    function draw() {
        // Draw the background
        ctx.fillStyle = CONFIG.colors.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid borders if enabled in configuration
        if (CONFIG.showGridBorders) {
            ctx.strokeStyle = CONFIG.gridBorderColor;
            ctx.lineWidth = 0.5;
            // Vertical lines
            for (let x = 0; x <= CONFIG.gridWidth; x++) {
                ctx.beginPath();
                ctx.moveTo(x * CELL_SIZE, 0);
                ctx.lineTo(x * CELL_SIZE, canvas.height);
                ctx.stroke();
            }
            // Horizontal lines
            for (let y = 0; y <= CONFIG.gridHeight; y++) {
                ctx.beginPath();
                ctx.moveTo(0, y * CELL_SIZE);
                ctx.lineTo(canvas.width, y * CELL_SIZE);
                ctx.stroke();
            }
        }

        // Draw normal food as a reduced square centered in the cell
        if (food) {
            ctx.fillStyle = CONFIG.colors.food;
            const foodInset = CELL_SIZE * CONFIG.foodInset;
            ctx.fillRect(
                food.x * CELL_SIZE + foodInset,
                food.y * CELL_SIZE + foodInset,
                CELL_SIZE - foodInset * 2,
                CELL_SIZE - foodInset * 2
            );
        }

        // Draw special food as a blinking diamond
        // Alternates between two colors every 4 ticks to create the blink effect
        if (specialFood) {
            ctx.fillStyle = tickCount % 4 < 2 ? CONFIG.colors.specialFood : CONFIG.colors.specialFoodAlt;
            const cx = specialFood.x * CELL_SIZE + CELL_SIZE / 2;
            const cy = specialFood.y * CELL_SIZE + CELL_SIZE / 2;
            const r = (CELL_SIZE - 4) / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy - r);       // Top point
            ctx.lineTo(cx + r, cy);       // Right point
            ctx.lineTo(cx, cy + r);       // Bottom point
            ctx.lineTo(cx - r, cy);       // Left point
            ctx.closePath();
            ctx.fill();
        }

        // Draw each snake segment
        for (let i = 0; i < snake.length; i++) {
            const seg = snake[i];
            // The head may have a different color from the body
            ctx.fillStyle = i === 0 ? CONFIG.colors.snakeHead : CONFIG.colors.snake;
            // Head and body have different insets (configurable)
            const inset = i === 0
                ? Math.floor(CELL_SIZE * CONFIG.snakeHeadInset)
                : Math.floor(CELL_SIZE * CONFIG.snakeBodyInset);
            ctx.fillRect(
                seg.x * CELL_SIZE + inset,
                seg.y * CELL_SIZE + inset,
                CELL_SIZE - inset * 2,
                CELL_SIZE - inset * 2
            );
        }

        // Draw eyes on the snake head
        // Eye position changes based on movement direction
        if (snake.length > 0) {
            const head = snake[0];
            ctx.fillStyle = CONFIG.colors.eyes;
            const eyeSize = Math.max(2, CELL_SIZE / 7);
            const hcx = head.x * CELL_SIZE + CELL_SIZE / 2;  // Head center X
            const hcy = head.y * CELL_SIZE + CELL_SIZE / 2;  // Head center Y
            let e1x, e1y, e2x, e2y;
            const off = CELL_SIZE / 6;  // Eye offset from center

            // Position eyes based on current direction
            if (direction.x === 1) {
                // Direction: right -> eyes on the right side
                e1x = hcx + off; e1y = hcy - off;
                e2x = hcx + off; e2y = hcy + off;
            } else if (direction.x === -1) {
                // Direction: left -> eyes on the left side
                e1x = hcx - off; e1y = hcy - off;
                e2x = hcx - off; e2y = hcy + off;
            } else if (direction.y === -1) {
                // Direction: up -> eyes on top
                e1x = hcx - off; e1y = hcy - off;
                e2x = hcx + off; e2y = hcy - off;
            } else {
                // Direction: down -> eyes on bottom
                e1x = hcx - off; e1y = hcy + off;
                e2x = hcx + off; e2y = hcy + off;
            }

            // Draw the two eyes as small squares
            ctx.fillRect(e1x - eyeSize / 2, e1y - eyeSize / 2, eyeSize, eyeSize);
            ctx.fillRect(e2x - eyeSize / 2, e2y - eyeSize / 2, eyeSize, eyeSize);
        }
    }

    // =========================================================================
    // GAME OVER
    // =========================================================================

    /**
     * Handles end of game: stops the game, shows the game over screen
     * on the canvas, and after a short delay (1200ms) opens
     * the overlay for name input.
     * @param {string} title - Title to display (e.g. "GAME OVER" or "GAME INTERRUPTED")
     */
    function finishGame(title) {
        gameRunning = false;
        clearInterval(gameInterval);
        gameInterval = null;
        stopBtn.style.display = 'none';

        // Draw a semi-transparent overlay on the canvas
        ctx.fillStyle = 'rgba(155, 188, 15, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Write the title (e.g. "GAME OVER")
        ctx.fillStyle = CONFIG.colors.gameOver;
        ctx.font = `bold ${Math.floor(CELL_SIZE * 0.8)}px "Courier New", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, canvas.width / 2, canvas.height / 2 - CELL_SIZE * 0.6);

        // Write the final score
        ctx.font = `${Math.floor(CELL_SIZE * 0.6)}px "Courier New", monospace`;
        ctx.fillText(t('points') + ': ' + score, canvas.width / 2, canvas.height / 2 + CELL_SIZE * 0.5);

        // Store the score and show the name overlay after a delay
        // (so the player sees the game over screen first)
        pendingScore = score;
        setTimeout(() => {
            nameOverlayTitle.textContent = title;
            nameOverlayScore.textContent = t('points') + ': ' + pendingScore;
            nameInput.value = '';
            nameOverlay.style.display = 'flex';
            nameInput.focus();
        }, 1200);
    }

    /**
     * Saves the score with the player's entered name.
     * Sends a message to the VS Code extension to persist the data
     * in the leaderboard, then closes the overlay.
     */
    function saveScoreWithName() {
        const name = nameInput.value.trim().substring(0, 6) || '???';
        vscode.postMessage({ type: 'saveScore', score: pendingScore, name: name });
        nameOverlay.style.display = 'none';
        hasPlayed = true;
        startBtn.textContent = t('replay');
    }

    // =========================================================================
    // GAME START AND STOP
    // =========================================================================

    /**
     * Starts a new game. Closes the leaderboard if open,
     * resizes the canvas, initializes the game and starts the game loop.
     */
    function startGame() {
        if (showingLeaderboard) {
            toggleLeaderboard(false);
        }
        if (showingSettings) {
            toggleSettings(false);
        }
        nameOverlay.style.display = 'none';
        resizeCanvas();
        initGame();
        gameRunning = true;
        hasPlayed = true;
        startBtn.textContent = t('replay');
        stopBtn.style.display = 'inline-block';
        restartInterval();
        draw();
        canvas.focus();
    }

    /**
     * Stops the current game showing the interruption message.
     */
    function stopGame() {
        if (!gameRunning) return;
        finishGame(t('gameInterrupted'));
    }

    // =========================================================================
    // LEADERBOARD
    // =========================================================================

    /**
     * Shows or hides the leaderboard section.
     * When the leaderboard is shown, the canvas and score are
     * hidden and any ongoing game is stopped.
     * @param {boolean} show - true to show, false to hide
     */
    function toggleLeaderboard(show) {
        showingLeaderboard = show;
        if (show) {
            if (showingSettings) toggleSettings(false);
            // Hide game elements and show the leaderboard
            canvas.style.display = 'none';
            scoreDisplay.style.display = 'none';
            nameOverlay.style.display = 'none';
            leaderboardDiv.style.display = 'block';
            stopBtn.style.display = 'none';

            // Stop the game if running
            if (gameRunning) {
                gameRunning = false;
                clearInterval(gameInterval);
                gameInterval = null;
            }

            // Request leaderboard data from the host extension
            vscode.postMessage({ type: 'getLeaderboard' });
        } else {
            // Restore the game view
            canvas.style.display = 'block';
            scoreDisplay.style.display = 'block';
            leaderboardDiv.style.display = 'none';
        }
    }

    // =========================================================================
    // SETTINGS
    // =========================================================================

    /**
     * Shows or hides the settings page.
     * @param {boolean} show - true to show, false to hide
     */
    function toggleSettings(show) {
        showingSettings = show;
        if (show) {
            if (showingLeaderboard) toggleLeaderboard(false);
            canvas.style.display = 'none';
            scoreDisplay.style.display = 'none';
            nameOverlay.style.display = 'none';
            settingsPage.style.display = 'block';
            stopBtn.style.display = 'none';

            if (gameRunning) {
                gameRunning = false;
                clearInterval(gameInterval);
                gameInterval = null;
            }

            // Populate the language select
            langSelect.innerHTML = '';
            SUPPORTED_LANGUAGES.forEach(function (lang) {
                const option = document.createElement('option');
                option.value = lang.code;
                option.textContent = lang.label;
                if (lang.code === currentLang) option.selected = true;
                langSelect.appendChild(option);
            });

            gridToggleBtn.textContent = CONFIG.showGridBorders ? 'ON' : 'OFF';
        } else {
            canvas.style.display = 'block';
            scoreDisplay.style.display = 'block';
            settingsPage.style.display = 'none';
        }
    }

    /**
     * Updates all UI texts based on the current language.
     */
    function applyTranslations() {
        startBtn.textContent = hasPlayed ? t('replay') : t('startGame');
        stopBtn.textContent = t('stop');
        leaderboardBtn.textContent = t('leaderboard');
        settingsBtn.textContent = t('settings');
        scoreDisplay.textContent = t('score') + ': ' + score;
        nameInput.placeholder = t('namePlaceholder');
        nameSaveBtn.textContent = t('save');
        backBtn.textContent = t('back');

        // Leaderboard table headers
        const headers = document.querySelectorAll('#leaderboard-table thead th');
        if (headers.length === 4) {
            headers[0].textContent = t('rank');
            headers[1].textContent = t('name');
            headers[2].textContent = t('pointsHeader');
            headers[3].textContent = t('date');
        }

        // Leaderboard title and labels
        const leaderboardTitle = document.querySelector('#leaderboard h3');
        if (leaderboardTitle) leaderboardTitle.textContent = t('leaderboard');

        // Settings title and labels
        if (settingsTitle) settingsTitle.textContent = t('settings');
        if (settingsLangLabel) settingsLangLabel.textContent = t('language');
        if (settingsGridLabel) settingsGridLabel.textContent = t('showGrid');
        if (settingsBackBtn) settingsBackBtn.textContent = t('back');

        // Redraw idle screen if not in game and not on other pages
        if (!gameRunning && !showingLeaderboard && !showingSettings) {
            drawIdle();
        }
    }

    /**
     * Saves the current settings to the host extension.
     */
    function saveCurrentSettings() {
        vscode.postMessage({
            type: 'saveSettings',
            settings: { language: currentLang, showGridBorders: CONFIG.showGridBorders },
        });
    }

    // =========================================================================
    // EVENT LISTENERS - User event handling
    // =========================================================================

    /** Click on the "Start Game" / "Replay" button */
    startBtn.addEventListener('click', startGame);

    /** Click on the "Stop" button */
    stopBtn.addEventListener('click', stopGame);

    /** Click on the "Leaderboard" button */
    leaderboardBtn.addEventListener('click', () => toggleLeaderboard(true));

    /** Click on the "Back" button from the leaderboard */
    backBtn.addEventListener('click', () => {
        toggleLeaderboard(false);
        if (!gameRunning) {
            drawIdle();
        }
    });

    /** Click on the "Settings" button */
    settingsBtn.addEventListener('click', () => toggleSettings(true));

    /** Click on the "Back" button from settings */
    settingsBackBtn.addEventListener('click', () => {
        toggleSettings(false);
        if (!gameRunning) {
            drawIdle();
        }
    });

    /** Language change */
    langSelect.addEventListener('change', () => {
        currentLang = langSelect.value;
        applyTranslations();
        saveCurrentSettings();
    });

    /** Grid toggle */
    gridToggleBtn.addEventListener('click', () => {
        CONFIG.showGridBorders = !CONFIG.showGridBorders;
        gridToggleBtn.textContent = CONFIG.showGridBorders ? 'ON' : 'OFF';
        saveCurrentSettings();
    });

    /** Click on the "Save" button in the name overlay */
    nameSaveBtn.addEventListener('click', saveScoreWithName);

    /** Enter key press in the name field -> save the score */
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveScoreWithName();
        }
        // Prevent the key from being handled by the game as well
        e.stopPropagation();
    });

    /**
     * Keyboard controls handling during the game.
     * Supports arrow keys and WASD keys.
     * Direction is buffered to prevent 180-degree reversals
     * (you can't go left if you're going right).
     */
    document.addEventListener('keydown', (e) => {
        if (!gameRunning) return;

        let newDir = null;
        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W': newDir = { x: 0, y: -1 }; break;
            case 'ArrowDown': case 's': case 'S': newDir = { x: 0, y: 1 }; break;
            case 'ArrowLeft': case 'a': case 'A': newDir = { x: -1, y: 0 }; break;
            case 'ArrowRight': case 'd': case 'D': newDir = { x: 1, y: 0 }; break;
        }

        if (newDir) {
            // Prevent 180-degree reversal (e.g. from right to left)
            if (newDir.x !== -direction.x || newDir.y !== -direction.y) {
                nextDirection = newDir;
            }
            e.preventDefault();
            e.stopPropagation();
        }
    });

    // =========================================================================
    // MESSAGES FROM THE HOST EXTENSION
    // =========================================================================

    /**
     * Listens for messages from the VS Code extension.
     * Handles receiving leaderboard data.
     */
    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.type) {
            case 'leaderboardData':
                renderLeaderboard(message.entries);
                break;
            case 'scoreSaved':
                // Score was saved successfully (no action needed)
                break;
            case 'settingsData':
                currentLang = message.settings.language;
                CONFIG.showGridBorders = message.settings.showGridBorders;
                applyTranslations();
                break;
        }
    });

    /**
     * Renders the leaderboard table with data received from the extension.
     * Shows position, name, score and date for each entry.
     * If there are no scores, displays a "No scores" message.
     * @param {Array} entries - Array of {score, name, date} objects
     */
    function renderLeaderboard(entries) {
        leaderboardBody.innerHTML = '';

        if (entries.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="4">' + t('noScores') + '</td>';
            leaderboardBody.appendChild(row);
            return;
        }

        entries.forEach((entry, index) => {
            const row = document.createElement('tr');

            // Format the date in localized format (dd/mm/yyyy hh:mm)
            const date = new Date(entry.date);
            const dateStr = date.toLocaleDateString(t('dateLocale'), {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            }) + ' ' + date.toLocaleTimeString(t('dateLocale'), {
                hour: '2-digit',
                minute: '2-digit',
            });

            const name = entry.name || '???';
            row.innerHTML = `<td>${index + 1}</td><td>${name}</td><td>${entry.score}</td><td>${dateStr}</td>`;
            leaderboardBody.appendChild(row);
        });
    }

    // =========================================================================
    // WINDOW RESIZE HANDLING
    // =========================================================================

    /**
     * Resizes the canvas when the window changes size.
     * If the game is running, redraws immediately.
     */
    window.addEventListener('resize', () => {
        resizeCanvas();
        if (gameRunning) {
            draw();
        }
    });

    // =========================================================================
    // INITIAL SETUP
    // =========================================================================

    /** Resize the canvas to its initial size */
    resizeCanvas();

    /** Draw the initial idle screen */
    drawIdle();

    /** Request saved settings from the host extension */
    vscode.postMessage({ type: 'getSettings' });

    /** Make the canvas focusable to receive keyboard input */
    canvas.setAttribute('tabindex', '0');
})();
