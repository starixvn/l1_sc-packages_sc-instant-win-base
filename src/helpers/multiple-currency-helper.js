/**
 * MULTIPLE CURRENCY HELPER - Currency-Based Game Configuration
 *
 * PURPOSE:
 * Provides utilities for handling different currencies and their associated bet levels.
 * Supports multi-currency casinos where different currencies have different stake levels.
 *
 * CURRENCY GROUP SYSTEM:
 * - Each currency belongs to a "currency group" (e.g., USD, EUR, GBP)
 * - Each group has its own bet level configurations
 * - Players can only bet amounts allowed for their currency group
 *
 * USE CASES:
 * - Multi-currency casino support
 * - Regional betting restrictions
 * - Currency-specific game configurations
 * - Regulatory compliance for different markets
 */
export default {
    /**
     * GET ALLOWED BET LEVELS FOR PLAYER'S CURRENCY
     *
     * Retrieves the permitted bet amounts for a player's currency group.
     * Used for bet validation and UI display of available stakes.
     *
     * @param {Object} gameData - Game configuration data
     * @param {Object} player - Player session with currency information
     * @returns {Array} - Array of allowed bet amounts for this currency
     */
    getBetLevels(gameData, player) {
        // Find currency group settings matching player's currency
        const settings = gameData.currencyGroupGames.find(
            (x) => x.groupId.toString() === player.session.currencyGroupId
        );

        return settings?.betLevels ?? [];
    },

    /**
     * GET DEFAULT BET LEVEL FOR PLAYER'S CURRENCY
     *
     * Returns the recommended default bet amount for a player's currency group.
     * Used for setting initial bet amounts when players join the game.
     *
     * @param {Object} gameData - Game configuration data
     * @param {Object} player - Player session with currency information
     * @returns {number} - Default bet amount for this currency group
     */
    getDefaultBetLevel(gameData, player) {
        // Find currency group settings matching player's currency
        const settings = gameData.currencyGroupGames.find(
            (x) => x.groupId.toString() === player.session.currencyGroupId
        );

        return settings?.defaultBetLevel;
    },
};
