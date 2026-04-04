/**
 * ============================================================================
 * EXTENSION.TS - VS Code extension entry point
 * ============================================================================
 * This file is the main entry point of the extension.
 * It registers the webview provider (SnakeViewProvider) that creates
 * the game panel in the VS Code Explorer sidebar.
 * ============================================================================
 */

import * as vscode from 'vscode';
import { SnakeViewProvider } from './snakeViewProvider';

/**
 * Extension activation function.
 * Called automatically by VS Code when the extension is loaded.
 * Creates an instance of SnakeViewProvider and registers it as a
 * webview provider with ID 'snakeGame.gameView', defined in package.json.
 * The retainContextWhenHidden option preserves the game state even
 * when the panel is not visible (e.g. when switching tabs).
 * @param context - Extension context provided by VS Code
 */
export function activate(context: vscode.ExtensionContext) {
    const provider = new SnakeViewProvider(context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            SnakeViewProvider.viewType,
            provider,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );
}

/**
 * Extension deactivation function.
 * Called when the extension is disabled or VS Code is closed.
 * No specific cleanup is needed for this extension.
 */
export function deactivate() {}
