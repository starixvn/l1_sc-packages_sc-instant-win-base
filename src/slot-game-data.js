import { Table } from "sc-game-base";

/**
 * SLOT GAME DATA - Runtime Game State Management
 *
 * PURPOSE:
 * Extends base table game data with slot-specific runtime state.
 * Manages game session data, counters, and in-memory caches.
 *
 * INHERITANCE:
 * Extends Table.TableGameData which provides:
 * - remainingTime: Round countdown timer
 * - Basic table game state management
 *
 * SLOT-SPECIFIC STATE:
 * - freeSpinId: Auto-incrementing counter for free spin record IDs
 * - Manages active player sessions and their game states
 * - Tracks queued bets, bonus games, and free spin sets
 */
export default class SlotGameData extends Table.TableGameData {
    /**
     * @param {number} remainingTime - Initial round time remaining in seconds
     */
    constructor(remainingTime) {
        // Call parent constructor for base table game state
        super(remainingTime);

        // SLOT-SPECIFIC STATE INITIALIZATION
        this.freeSpinId = 1;  // Counter for generating unique free spin IDs
                             // Increments with each free spin award
                             // Persisted across server restarts via database
    }
}
