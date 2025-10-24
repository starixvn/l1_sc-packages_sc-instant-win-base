import { Table } from "sc-game-base";

/**
 * SLOT GAME DEFINITION - Game Configuration & Timing
 *
 * PURPOSE:
 * Extends the base table game definition with slot-specific configuration.
 * Defines game timing, feature durations, and bonus game parameters.
 *
 * SLOT-SPECIFIC CONFIGURATION:
 * - Free spin expiration times
 * - Bonus game chest counts and timeouts
 * - Jackpot game durations
 * - Bonus calculation method selection
 *
 * INHERITANCE:
 * Extends Table.TableGameDefinition which provides:
 * - Basic game identification (id, name)
 * - Round timing (durations)
 * - Bet choices and history settings
 */
export default class SlotGameDefinition extends Table.TableGameDefinition {
    /**
     * @param {Object} config - Slot game configuration
     * @param {number} config.id - Unique game identifier
     * @param {string} config.name - Game display name
     * @param {Object} config.durations - Round timing configuration
     * @param {Array} config.choices - Available bet choices
     * @param {Object} config.choicesMapper - Bet choice mappings
     * @param {number} config.historyPageSize - Game history page size
     * @param {number} config.freeSpinLiveSeconds - Free spin expiration (default: 86400 = 24 hours)
     * @param {number} config.bonusSize - Number of bonus chests (default: 10)
     * @param {number} config.bonusLiveSeconds - Bonus game timeout (default: 125 seconds)
     * @param {number} config.jackpotLiveSeconds - Jackpot game duration (default: 65 seconds)
     * @param {number} config.delaySecondsAfterJackpot - Delay before bonus after jackpot (default: 2 seconds)
     * @param {boolean} config.applyNewBonusCalculation - Use updated bonus multiplier calculation
     */
    constructor({
        id = 0,
        name = "",
        durations = {},
        choices = [],
        choicesMapper = {},
        historyPageSize = 8,
        freeSpinLiveSeconds = 86400, // 24 hours
        bonusSize = 10,
        bonusLiveSeconds = 125,
        jackpotLiveSeconds = 65,
        delaySecondsAfterJackpot = 2,
        applyNewBonusCalculation = false,
    }) {
        // Call parent constructor with base table game parameters
        super({ id, name, durations, choices, choicesMapper, historyPageSize }, null, null);

        // SLOT-SPECIFIC TIMING AND FEATURE CONFIGURATION
        this.freeSpinLiveSeconds = freeSpinLiveSeconds;        // How long free spins remain valid
        this.bonusSize = bonusSize;                            // Number of chests in bonus mini-game
        this.bonusLiveSeconds = bonusLiveSeconds;              // Bonus game abandonment timeout
        this.jackpotLiveSeconds = jackpotLiveSeconds;          // Jackpot wheel spin duration
        this.applyNewBonusCalculation = applyNewBonusCalculation; // New vs legacy bonus math
        this.delaySecondsAfterJackpot = delaySecondsAfterJackpot; // Pause between jackpot and bonus
    }
}
