import SlotGameData from "./../slot-game-data";

/**
 * BOARD CHEATING CONSUMER - Admin Board Override System
 *
 * PURPOSE:
 * Allows administrators to force specific board outcomes for testing and moderation.
 * Bypasses normal random generation to ensure predictable results.
 *
 * USE CASES:
 * - Testing specific game scenarios
 * - Reproducing reported bugs
 * - Demonstrating game features
 * - Quality assurance testing
 * - Customer support investigations
 *
 * SECURITY CONSIDERATIONS:
 * - Only accessible to admin users
 * - Overrides are temporary and cleaned up after use
 * - Does not affect normal player gameplay
 */
export default class BoardCheatingConsumer {
    /**
     * @param {SlotGameData} gameData - Runtime game state with admin override storage
     */
    constructor(gameData) {
        this.gameData = gameData;
    }

    /**
     * APPLY BOARD CHEATING - Override Random Generation
     *
     * Checks if an admin has set a forced board result for this player.
     * If found, uses the admin-defined board instead of the randomly generated one.
     *
     * Override Process:
     * 1. Check for admin-defined board for this player
     * 2. If found, use admin board and clean up override
     * 3. Return either admin board or original random board
     *
     * Cleanup ensures one-time use - prevents persistent cheating.
     *
     * @param {string} name - Player name to check for overrides
     * @param {Array} board - The randomly generated board
     * @returns {Array} - Either admin-forced board or original board
     */
    consume(name, board) {
        // Check for admin-defined board override
        const resultFromAdmin = this.gameData.settlementResultFromAdmin[name];
        let finalResult = board;

        if (resultFromAdmin) {
            // Admin override found - use it instead of random board
            delete this.gameData.settlementResultFromAdmin[name];  // One-time use

            finalResult = resultFromAdmin ?? finalResult;
        }

        return finalResult;
    }
}
