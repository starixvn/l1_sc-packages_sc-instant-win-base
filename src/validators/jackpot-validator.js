/**
 * JACKPOT VALIDATOR - Security & Access Control
 *
 * PURPOSE:
 * Controls player eligibility for jackpot features to prevent abuse and ensure fair play.
 * Validates access rights, contribution permissions, and win eligibility.
 *
 * SECURITY CONCERNS ADDRESSED:
 * 1. **Player Restrictions**: Some players may be excluded from jackpot games
 * 2. **Test Currency Control**: Test accounts may be blocked from real jackpots
 * 3. **Free Spin Exclusion**: Free spins may not contribute to progressive pools
 * 4. **Feature Toggles**: Ability to disable jackpot system entirely
 *
 * VALIDATION HIERARCHY:
 * canAccessJackpot() → canContributeJackpotPools() → canHitJackpot()
 */
export default class JackpotValidator {
    /**
     * @param {Object} gameData - Runtime game configuration and state
     */
    constructor(gameData) {
        this.gameData = gameData;
    }

    /**
     * BASIC JACKPOT ACCESS CHECK
     *
     * Determines if player can participate in jackpot features at all.
     * Checks both system-level and player-level settings.
     *
     * @param {Object} player - Player session data
     * @returns {boolean} - True if player can access jackpot features
     */
    canAccessJackpot(player) {
        const { jackpot } = this.gameData.gameConfigs.slotsConfig;

        // Jackpot system must be enabled globally
        if (jackpot.enabled) {
            // Player must not be individually restricted
            return !player.session.disableJackpotGames;
        }

        return false;
    }

    /**
     * JACKPOT CONTRIBUTION ELIGIBILITY
     *
     * Checks if player can contribute to progressive jackpot pools.
     * More restrictive than basic access - excludes free spins and test currencies.
     *
     * @param {Object} player - Player session data
     * @param {boolean} freeSpin - Whether this is a free spin bet
     * @returns {boolean} - True if player can contribute to jackpot pools
     */
    canContributeJackpotPools(player, freeSpin) {
        const { jackpot } = this.gameData.gameConfigs.slotsConfig;

        // Must pass basic access check
        if (this.canAccessJackpot(player)) {
            const { session } = player;

            // Check if player is using test currency
            const isTestCurrency = this.gameData.currencies.some(
                (currency) => currency.name === session.currencyName && currency.isTest
            );

            // Allow contribution if:
            // 1. Not a free spin (free spins don't contribute)
            // 2. Either not test currency, or test currencies are allowed
            return !freeSpin && (!isTestCurrency || !jackpot.excludeTestCurrency);
        }

        return false;
    }

    /**
     * JACKPOT WIN ELIGIBILITY
     *
     * Checks if player can actually win jackpots when they hit the symbols.
     * Most permissive check - focuses on currency restrictions only.
     *
     * @param {Object} player - Player session data
     * @returns {boolean} - True if player can win jackpots
     */
    canHitJackpot(player) {
        const { jackpot } = this.gameData.gameConfigs.slotsConfig;

        // Must pass basic access check
        if (this.canAccessJackpot(player)) {
            const { session } = player;

            // Check if player is using test currency
            const isTestCurrency = this.gameData.currencies.some(
                (currency) => currency.name === session.currencyName && currency.isTest
            );

            // Allow jackpot wins if not test currency or test currencies are allowed
            return !isTestCurrency || !jackpot.excludeTestCurrency;
        }

        return false;
    }
}
