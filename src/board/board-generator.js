import Chance from "chance";
import defaultDefinition from "./default-definition";
import difficulties from "./difficulties";

/**
 * BOARD GENERATOR - Weighted Random Symbol Distribution
 *
 * PURPOSE:
 * Generates random 5x3 slot boards using weighted probability distributions.
 * Controls RTP (Return to Player) through symbol frequency manipulation.
 *
 * WEIGHTED RANDOM SELECTION:
 * - Higher weights = more frequent symbol appearance
 * - Creates predictable RTP while appearing completely random
 * - Different strategies for players vs bots
 */
export default class BoardGenerator {
    /**
     * @param {defaultDefinition} boardDefinition - Game configuration object
     * @param {Object} gameData - Runtime game state and configuration
     */
    constructor(boardDefinition, gameData) {
        this.chance = new Chance();  // Random number generator instance
        this.definition = boardDefinition ?? defaultDefinition;
        this.numberOfPaylines = this.definition.paylines.length;  // Always 25 paylines

        this.gameData = gameData;  // Access to game configs and difficulty settings
    }

    /**
     * GENERATE BOARD FOR HUMAN PLAYERS
     *
     * Priority System:
     * 1. Custom weights from slotsConfig.symbolWeight[difficulty] (if configured)
     * 2. Default difficulty strategies (easy/medium/hard)
     *
     * @param {number} difficulty - Difficulty level (1=easy, 2=medium, 3=hard)
     * @returns {Array} - 15-symbol board array
     */
    generate(difficulty) {
        const { slotsConfig } = this.gameData.gameConfigs;

        // Allow runtime configuration override of default strategies
        return this.generateByStrategy(
            slotsConfig.symbolWeight?.[difficulty] ?? this.getFillingStrategy(difficulty)
        );
    }

    /**
     * GENERATE BOARD FOR BOT PLAYERS
     *
     * Bot Behavior:
     * - Maintains game activity when no human players
     * - Controlled jackpot probability to prevent pool depletion
     * - Slightly different symbol distribution for variety
     *
     * Jackpot Probability Calculation:
     * - jackpotPossibilityRange = 2000 (base range)
     * - botRatio = 40 (default divider)
     * - Max possibility = 2000/40 = 50
     * - Random roll = 0-50, jackpot when roll === 50
     * - Probability = 1/51 ≈ 2%
     *
     * @param {boolean} isJackpotEnabled - Whether jackpot feature is active
     * @param {number} botRatio - Controls jackpot frequency (higher = rarer)
     * @returns {Array} - 15-symbol board array
     */
    generateForBots(isJackpotEnabled, botRatio = 40) {
        // Calculate jackpot probability: 1 in (2000/botRatio + 1)
        const maxJackpotPossibility = Math.round(this.definition.fillingStrategyForBots.jackpotPossibilityRange / botRatio);
        const jackpotPossibility = this.chance.natural({ min: 0, max: maxJackpotPossibility });

        // Trigger jackpot mode only when roll equals max AND jackpot is enabled
        const fillingStrategy =
            jackpotPossibility === maxJackpotPossibility && isJackpotEnabled
                ? this.definition.fillingStrategyForBots.jackpot  // Force jackpot win
                : this.definition.fillingStrategyForBots.normal;  // Normal bot play

        return this.generateByStrategy(fillingStrategy);
    }

    /**
     * CORE GENERATION LOGIC - Weighted Random Selection
     *
     * How it works:
     * 1. For each row's weight array [w0, w1, w2, ..., w10]
     * 2. Create expanded array: w0 symbols of '0', w1 symbols of '1', etc.
     * 3. Randomly pick 5 symbols from this weighted pool
     * 4. Repeat for 3 rows to create 15-symbol board
     *
     * Example for Easy Row 1: [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5]
     * - Creates pool: 55×'0', 50×'1', 45×'2', ..., 5×'10' (total 330 slots)
     * - Probability: Symbol 0 = 55/330 ≈ 16.7%, Symbol 10 = 5/330 ≈ 1.5%
     *
     * @param {Array} fillingStrategy - 3 arrays of 11 weights each
     * @returns {Array} - Shuffled 15-symbol board
     */
    generateByStrategy(fillingStrategy) {
        const board = [];

        for (const rowWeight of fillingStrategy) {
            // Step 1: Convert weights to expanded symbol array
            // [55, 50, 45, ...] → ['0','0',...,'1','1',...,'10','10',...]
            const filledSymbols = rowWeight.reduce((result, repeat, symbol) =>
                result.concat(Array(repeat).fill(symbol)), []);

            // Step 2: Randomly select 5 symbols for this row (5 columns)
            board.push(...this.chance.pickset(filledSymbols, this.definition.numberOfColumns));
        }

        // Step 3: Shuffle final board for randomness
        return this.shuffle(board);
    }

    /**
     * BOARD SHUFFLING - Ensures True Randomness
     *
     * Why shuffle multiple times?
     * - Single shuffle might not fully randomize row-based generation
     * - Multiple shuffles eliminate any positional patterns
     * - Maintains provably fair randomness
     *
     * @param {Array} board - 15-symbol board array
     * @param {number} times - Number of shuffle iterations (default: 3)
     * @returns {Array} - Fully randomized board
     */
    shuffle(board, times = 3) {
        let shuffledBoard;
        for (let time = 0; time < times; time++) {
            shuffledBoard = this.chance.shuffle(board);
        }

        return shuffledBoard;
    }

    /**
     * GET DIFFICULTY STRATEGY
     *
     * Maps difficulty numbers to filling strategies:
     * - 1 (difficulties.easy) → fillingStrategies.easy
     * - 2 (difficulties.medium) → fillingStrategies.medium
     * - 3 (difficulties.hard) → fillingStrategies.hard
     *
     * @param {number} difficulty - Difficulty level
     * @returns {Array} - 3x11 weight matrix for the difficulty
     */
    getFillingStrategy(difficulty) {
        switch (difficulty) {
            case difficulties.hard:
                return this.definition.fillingStrategies.hard;
            case difficulties.medium:
                return this.definition.fillingStrategies.medium;
            default:
                return this.definition.fillingStrategies.easy;
        }
    }
}
