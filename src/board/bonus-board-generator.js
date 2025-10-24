import Chance from "chance";

import SlotGameDefinition from "./../slot-game-definition";
import defaultDefinition from "./default-definition";

/**
 * BONUS BOARD GENERATOR - Interactive Bonus Prize Creation
 *
 * PURPOSE:
 * Generates random prize amounts for bonus mini-game chests.
 * Creates excitement through variable prize distributions and fair randomization.
 *
 * BONUS MINI-GAME FLOW:
 * 1. Player triggers bonus (3+ bonus symbols in column)
 * 2. System generates 10 chests with random prizes
 * 3. Player opens chests manually to collect prizes
 * 4. Game completes when all required chests are opened
 *
 * PRIZE CALCULATION:
 * - Uses configured min/max rates from game settings
 * - Applies payline-based multipliers for fairness
 * - Supports legacy vs new calculation methods
 */
export default class BonusBoardGenerator {
    /**
     * @param {SlotGameDefinition} definition - Game configuration with bonus settings
     * @param {defaultDefinition} boardDefinition - Board configuration with payline count
     */
    constructor(definition, boardDefinition) {
        this.chance = new Chance();  // Random number generator
        this.size = definition.bonusSize;  // Number of bonus chests (default: 10)
        this.totalPaylines = (boardDefinition ?? defaultDefinition).paylines.length;  // Total paylines (25)
        this.applyNewBonusCalculation = definition.applyNewBonusCalculation;  // New vs legacy math
    }

    /**
     * GENERATE BONUS CHESTS - Create Prize Board
     *
     * Creates an array of bonus chests with random prize amounts.
     * Each chest contains a multiplier applied to the player's bet amount.
     *
     * Prize Distribution:
     * - Random multipliers between minRate and maxRate
     * - Adjusted based on number of paylines played
     * - Shuffled multiple times for fairness
     *
     * @param {number} betAmount - Player's bet amount per payline
     * @param {number} minRate - Minimum prize multiplier
     * @param {number} maxRate - Maximum prize multiplier
     * @param {number} numberOfPaylines - Paylines played (affects prize scaling)
     * @returns {Array} - Array of chest objects with amount and picked status
     */
    generate(betAmount, minRate, maxRate, numberOfPaylines) {
        let bonusBoard = [];

        // Generate prizes for each bonus chest
        for (let counter = 0; counter < this.size; counter++) {
            // Calculate random prize multiplier
            const bonusRate = this.applyNewBonusCalculation
                ? this.chance.natural(this.calculateBonusRateRange(minRate, maxRate, numberOfPaylines))
                : this.chance.natural({ min: minRate, max: maxRate });

            // Calculate actual prize amount
            const amount = parseFloat((bonusRate * betAmount).toFixed(2));
            const bonus = { amount, picked: false };

            bonusBoard.push(bonus);
        }

        // Shuffle multiple times for true randomness
        bonusBoard = this.chance.shuffle(bonusBoard);
        bonusBoard = this.chance.shuffle(bonusBoard);
        bonusBoard = this.chance.shuffle(bonusBoard);

        return bonusBoard;
    }

    /**
     * CALCULATE BONUS RATE RANGE - New Calculation Method
     *
     * Advanced prize scaling based on paylines played.
     * Rewards players who bet on more paylines with higher potential prizes.
     *
     * Scaling Logic:
     * - paylinesRate = max(numberOfPaylines - 2, 1)
     * - Scales min/max rates proportionally to paylines played
     * - Ensures minimum prize of 1x bet, maximum scaled appropriately
     *
     * Example: 25 paylines → paylinesRate = 23
     * Min rate scaled up, max rate scaled up proportionally
     *
     * @param {number} minRate - Base minimum rate
     * @param {number} maxRate - Base maximum rate
     * @param {number} numberOfPaylines - Paylines played
     * @returns {Object} - {min, max} range for random selection
     */
    calculateBonusRateRange(minRate, maxRate, numberOfPaylines) {
        // Calculate payline scaling factor (minimum 1)
        const paylinesRate = Math.max(numberOfPaylines - 2, 1);

        // Scale rates based on paylines played
        const min = Math.max((minRate / this.totalPaylines) * paylinesRate, 1);  // Minimum 1x bet
        const max = Math.max((maxRate / this.totalPaylines) * paylinesRate, 3);  // Minimum 3x bet

        // Return integer bounds for random selection
        return {
            min: Math.floor(parseFloat(min.toFixed(2))),
            max: Math.floor(parseFloat(max.toFixed(2)))
        };
    }
}
