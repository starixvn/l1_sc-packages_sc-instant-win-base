import Chance from "chance";

import JackpotValidator from "../validators/jackpot-validator";
import SlotGameDefinition from "./../slot-game-definition";

/**
 * JACKPOT PRIZE GENERATOR - Progressive Jackpot Wheel Creation
 *
 * PURPOSE:
 * Generates the prize wheel for jackpot wins, determining which jackpot tiers
 * are available for the player to potentially win.
 *
 * JACKPOT WIN PROCESS:
 * 1. Player gets 5 jackpot symbols in a single payline
 * 2. System generates 10 potential prizes (weighted by pool allocation)
 * 3. Player spins wheel to select final prize
 * 4. Selected prize tier determines jackpot amount won
 *
 * PRIZE DISTRIBUTION:
 * - Grand, Major, Minor jackpot tiers
 * - Weighted based on player allocation settings
 * - Ensures fair distribution while maintaining excitement
 */
export default class JackpotPrizeGenerator {
    /**
     * @param {SlotGameDefinition} definition - Game configuration
     * @param {SlotGameData} gameData - Runtime game state
     * @param {JackpotValidator} jackpotValidator - Eligibility validation
     */
    constructor(definition, gameData, jackpotValidator) {
        this.definition = definition;
        this.gameData = gameData;
        this.size = definition.jackpotSize ?? 10;  // Number of prizes on wheel (default: 10)
        this.jackpotValidator = jackpotValidator;

        this.chance = new Chance();  // Random number generator
    }

    /**
     * GENERATE JACKPOT PRIZES - Create Prize Wheel
     *
     * Creates an array of jackpot tier names for the prize wheel.
     * Distribution is weighted based on player allocation settings.
     *
     * Validation:
     * - Checks if player is eligible for jackpot wins
     * - Returns empty array if player cannot win jackpots
     *
     * Prize Distribution Logic:
     * - pools = { grand: { playerSettings: { alloc: 1 } }, major: {...}, minor: {...} }
     * - weights = [1, 1, 1] (equal distribution by default)
     * - chance.weighted(['grand', 'major', 'minor'], [1, 1, 1])
     *
     * @param {Object} player - Player session data
     * @returns {Array} - Array of prize tier names (e.g., ['grand', 'major', 'minor', ...])
     */
    generate(player) {
        // Validate jackpot eligibility (free spins, promotions, etc.)
        if (!this.jackpotValidator.canHitJackpot(player)) {
            return [];  // Player not eligible for jackpot wins
        }

        // Get jackpot pool configuration
        const { pools } = this.gameData.gameConfigs.slotsConfig.jackpot;
        const prizes = Object.keys(pools);    // ['grand', 'major', 'minor']
        const weights = Object.values(pools).map((pool) =>
            (pool.playerSettings.alloc > 0 ? pool.playerSettings.alloc : 1)
        );  // Allocation weights, minimum 1

        let jackpotBoard = [];

        // Generate prize wheel with weighted distribution
        for (let counter = 0; counter < this.size; counter++) {
            jackpotBoard.push(this.chance.weighted(prizes, weights));
        }

        // Shuffle multiple times for fairness
        jackpotBoard = this.chance.shuffle(jackpotBoard);
        jackpotBoard = this.chance.shuffle(jackpotBoard);
        jackpotBoard = this.chance.shuffle(jackpotBoard);

        return jackpotBoard;
    }
}
