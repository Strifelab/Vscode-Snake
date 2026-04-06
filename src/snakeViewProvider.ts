/**
 * ============================================================================
 * SNAKE VIEW PROVIDER - Webview provider for the Snake game
 * ============================================================================
 * This file manages the creation and communication of the webview
 * that contains the game. It generates the complete HTML with references to
 * game.js and game.css, and handles message exchange between the
 * webview (frontend) and the extension (backend) for saving
 * and retrieving the leaderboard.
 * ============================================================================
 */

import * as vscode from 'vscode';
import { getLeaderboard, addScore } from './leaderboard';

const SETTINGS_KEY = 'snakeGame.settings';
const SUPPORTED_LANGUAGES = ['it', 'en', 'fr', 'es'];
const DEFAULT_LANGUAGE = 'en';

interface GameSettings {
    language: string;
    showGridBorders: boolean;
    speed: number;
}

/**
 * Webview provider implementing VS Code's WebviewViewProvider interface.
 * Responsible for:
 * - Generating the webview HTML with a secure CSP (Content Security Policy)
 * - Handling incoming messages from the webview (score saving, leaderboard requests)
 * - Providing access to static resources (JS and CSS) in the media/ folder
 */
export class SnakeViewProvider implements vscode.WebviewViewProvider {
    /** Unique view identifier, must match the one in package.json */
    public static readonly viewType = 'snakeGame.gameView';

    /** Reference to the current webview view */
    private _view?: vscode.WebviewView;

    /**
     * Provider constructor.
     * @param _context - Extension context, used for accessing global storage and resource URIs
     */
    constructor(private readonly _context: vscode.ExtensionContext) {}

    private _getDefaultLanguage(): string {
        const vscodeLang = vscode.env.language.split('-')[0];
        return SUPPORTED_LANGUAGES.includes(vscodeLang) ? vscodeLang : DEFAULT_LANGUAGE;
    }

    private _getSettings(): GameSettings {
        const saved = this._context.globalState.get<GameSettings>(SETTINGS_KEY);
        return {
            language: saved?.language ?? this._getDefaultLanguage(),
            showGridBorders: saved?.showGridBorders ?? true,
            speed: saved?.speed ?? 5,
        };
    }

    /**
     * Method called by VS Code when the view needs to be rendered.
     * Configures webview options (scripts enabled, local resources),
     * generates the HTML and sets up the message listener from the webview.
     * @param webviewView - Webview view instance to configure
     * @param _context - Resolution context (unused)
     * @param _token - Cancellation token (unused)
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        // Configure webview options
        webviewView.webview.options = {
            enableScripts: true,  // Enable JavaScript execution
            localResourceRoots: [
                // Restrict resource access to the media/ folder only
                vscode.Uri.joinPath(this._context.extensionUri, 'media'),
            ],
        };

        // Generate and assign the game page HTML
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Listen for messages from the webview (game frontend)
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.type) {
                case 'saveScore':
                    // The game requested to save a score
                    await addScore(this._context, message.score, message.name || '???');
                    // Confirm the save to the webview
                    webviewView.webview.postMessage({ type: 'scoreSaved' });
                    break;
                case 'getLeaderboard':
                    // The game requested leaderboard data
                    const entries = getLeaderboard(this._context);
                    // Send leaderboard data to the webview
                    webviewView.webview.postMessage({
                        type: 'leaderboardData',
                        entries,
                    });
                    break;
                case 'getSettings':
                    webviewView.webview.postMessage({
                        type: 'settingsData',
                        settings: this._getSettings(),
                    });
                    break;
                case 'saveSettings':
                    await this._context.globalState.update(SETTINGS_KEY, message.settings);
                    webviewView.webview.postMessage({ type: 'settingsSaved' });
                    break;
            }
        });
    }

    /**
     * Generates the complete HTML for the game webview.
     * Includes the Content Security Policy (CSP) with nonce for security,
     * references to CSS and JS files, and the game HTML structure
     * with canvas, buttons, name overlay and leaderboard section.
     * @param webview - Webview instance for generating secure URIs
     * @returns {string} Complete HTML string of the page
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Generate secure URIs for resources in the media/ folder
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'media', 'game.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'media', 'game.css')
        );
        const i18nConfigUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'media', 'i18n', 'config.js')
        );
        const i18nItUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'media', 'i18n', 'it.js')
        );
        const i18nEnUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'media', 'i18n', 'en.js')
        );
        const i18nFrUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'media', 'i18n', 'fr.js')
        );
        const i18nEsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._context.extensionUri, 'media', 'i18n', 'es.js')
        );

        // Generate a random nonce for the CSP (prevents execution of unauthorized scripts)
        const nonce = getNonce();

        return `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
    <link href="${styleUri}" rel="stylesheet">
    <title>Snake Game</title>
</head>
<body>
    <div id="game-container">
        <!-- Main canvas where the game is drawn -->
        <canvas id="gameCanvas"></canvas>

        <!-- Current score display -->
        <div id="score-display">Score: 0</div>

        <!-- Game control buttons -->
        <div id="buttons">
            <button id="startBtn">Start Game</button>
            <button id="stopBtn" style="display:none">Stop</button>
            <button id="leaderboardBtn">Leaderboard</button>
            <button id="settingsBtn">Settings</button>
        </div>

        <!-- Overlay for name input at game over -->
        <div id="name-overlay" style="display:none">
            <div id="name-overlay-box">
                <div id="name-overlay-title">GAME OVER</div>
                <div id="name-overlay-score">Points: 0</div>
                <input type="text" id="nameInput" maxlength="6" placeholder="Name" autocomplete="off">
                <button id="nameSaveBtn">Save</button>
            </div>
        </div>

        <!-- Pause overlay -->
        <div id="pause-overlay" style="display:none">
            <div id="pause-overlay-box">
                <div id="pause-overlay-title">PAUSED</div>
                <div id="pause-overlay-message">Click here to resume</div>
            </div>
        </div>

        <!-- Leaderboard section with top scores table -->
        <div id="leaderboard" style="display:none">
            <h3>Leaderboard</h3>
            <table id="leaderboard-table">
                <thead>
                    <tr><th>#</th><th>Name</th><th>Points</th><th>Date</th></tr>
                </thead>
                <tbody></tbody>
            </table>
            <button id="backBtn">Back</button>
        </div>

        <!-- Settings page -->
        <div id="settings-page" style="display:none">
            <h3 id="settings-title">Settings</h3>
            <div class="setting-row">
                <span id="settings-lang-label">Language</span>
                <select id="langSelect"></select>
            </div>
            <div class="setting-row">
                <span id="settings-speed-label">Speed</span>
                <input type="range" id="speedRange" min="1" max="10" value="5">
                <span id="speedValue">5</span>
            </div>
            <div class="setting-row">
                <span id="settings-grid-label">Show grid</span>
                <button id="gridToggleBtn">ON</button>
            </div>
            <button id="settingsBackBtn">Back</button>
        </div>
    </div>
    <script nonce="${nonce}" src="${i18nConfigUri}"></script>
    <script nonce="${nonce}" src="${i18nItUri}"></script>
    <script nonce="${nonce}" src="${i18nEnUri}"></script>
    <script nonce="${nonce}" src="${i18nFrUri}"></script>
    <script nonce="${nonce}" src="${i18nEsUri}"></script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

/**
 * Generates a cryptographically random nonce of 32 characters.
 * Used in the Content Security Policy to authorize only scripts
 * with the correct nonce, preventing XSS attacks.
 * @returns {string} Random string of 32 alphanumeric characters
 */
function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
