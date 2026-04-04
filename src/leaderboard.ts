/**
 * ============================================================================
 * LEADERBOARD - Persistent ranking system
 * ============================================================================
 * Manages saving and retrieving top scores.
 * Data is persisted in VS Code's global storage,
 * so it survives editor restarts and is shared
 * across all VS Code windows for the same user.
 * ============================================================================
 */

import * as vscode from 'vscode';

/**
 * Interface representing a single leaderboard entry.
 * Each entry contains the score, player name and date.
 */
export interface LeaderboardEntry {
    score: number;   // Score achieved in the game
    name: string;    // Player name (max 6 characters)
    date: string;    // Date and time in ISO 8601 format
}

/** Key used in VS Code's global storage to save the leaderboard */
const STORAGE_KEY = 'snakeGame.leaderboard';

/** Maximum number of entries kept in the leaderboard */
const MAX_ENTRIES = 10;

/**
 * Retrieves the leaderboard sorted from highest to lowest score.
 * Returns at most MAX_ENTRIES entries (top 10).
 * @param context - Extension context for accessing global storage
 * @returns {LeaderboardEntry[]} Sorted array of the best leaderboard entries
 */
export function getLeaderboard(context: vscode.ExtensionContext): LeaderboardEntry[] {
    const entries = context.globalState.get<LeaderboardEntry[]>(STORAGE_KEY, []);
    return entries.sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
}

/**
 * Adds a new score to the leaderboard.
 * The leaderboard is automatically re-sorted and truncated to MAX_ENTRIES entries.
 * Saving is asynchronous because it writes to VS Code's global storage.
 * @param context - Extension context for accessing global storage
 * @param score - Score achieved by the player
 * @param name - Player name (default: '???' if empty)
 */
export async function addScore(context: vscode.ExtensionContext, score: number, name: string): Promise<void> {
    const entries = context.globalState.get<LeaderboardEntry[]>(STORAGE_KEY, []);

    // Add the new entry with the current date
    entries.push({
        score,
        name: name || '???',
        date: new Date().toISOString(),
    });

    // Re-sort by descending score and keep only the top 10
    entries.sort((a, b) => b.score - a.score);
    await context.globalState.update(STORAGE_KEY, entries.slice(0, MAX_ENTRIES));
}
