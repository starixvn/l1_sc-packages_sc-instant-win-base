import defaultDefinition from "./../board/default-definition";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

import { BoardGenerator, BonusBoardGenerator, JackpotPrizeGenerator, PaylineCalculator } from "./../board";
import BoardCheatingConsumer from "./board-cheating-consumer";

/**
 * GENERATE RESULT CONSUMER - Game Round Result Orchestrator
 *
 * PURPOSE:
 * Coordinates the complete generation of game board results, including random board creation,
 * win calculation, special feature detection, and jackpot prize generation.
 *
 * RESULT GENERATION FLOW:
 * 1. **Board Generation**: Create random 5x3 symbol board based on difficulty
 * 2. **Admin Override**: Apply any admin-defined board cheating for testing
 * 3. **Win Calculation**: Evaluate all 25 paylines for wins and special features
 * 4. **Jackpot Setup**: Generate prize wheel if jackpot was triggered
 * 5. **Bonus Setup**: Prepare bonus mini-game if triggered
 * 6. **Result Filtering**: Separate jackpot wins from regular payline wins
 *
 * KEY RESPONSIBILITIES:
 * - Fair random board generation with RTP control
 * - Special feature detection (jackpots, bonuses, free spins)
 * - Multi-step settlement preparation
 * - Admin testing support through board cheating
 */
export default class GenerateResultConsumer {
    /**
     * @param {Object} dependencies
     * @param {SlotGameDefinition} dependencies.definition
     * @param {SlotGameData} dependencies.gameData
     * @param {BoardGenerator} dependencies.boardGenerator
     * @param {BonusBoardGenerator} dependencies.bonusBoardGenerator
     * @param {PaylineCalculator} dependencies.paylineCalculator
     * @param {BoardCheatingConsumer} dependencies.boardCheatingConsumer
     * @param {JackpotPrizeGenerator} dependencies.jackpotPrizeGenerator
     */

    constructor({
        definition,
        gameData,
        boardGenerator,
        bonusBoardGenerator,
        paylineCalculator,
        boardCheatingConsumer,
        boardDefinition,
        jackpotPrizeGenerator,
    }) {
        this.definition = definition;
        this.gameData = gameData;
        this.boardCheatingConsumer = boardCheatingConsumer;
        this.boardGenerator = boardGenerator;
        this.bonusBoardGenerator = bonusBoardGenerator;
        this.paylineCalculator = paylineCalculator;
        this.jackpotPrizeGenerator = jackpotPrizeGenerator;
        this.boardDefinition = boardDefinition ?? defaultDefinition;
    }

    /**
     * GENERATE COMPLETE SETTLEMENT RESULT - Main Orchestration Method
     *
     * Orchestrates the complete process of generating a game board and calculating all wins.
     * This is the primary method called by the settlement process.
     *
     * Process Flow:
     * 1. **Generate Board**: Create random symbol board (with potential admin override)
     * 2. **Calculate Wins**: Evaluate all paylines for regular wins and special features
     * 3. **Handle Jackpot**: Generate prize wheel if jackpot was triggered
     * 4. **Filter Paylines**: Separate jackpot payline from regular winning paylines
     *
     * Jackpot Special Handling:
     * Jackpots require special treatment because they involve:
     * - Multi-step client interaction (prize wheel spin)
     * - Progressive pool updates
     * - Delayed final settlement
     *
     * @param {Object} player - Player session data
     * @param {Object} bet - Bet details including paylines to evaluate
     * @param {Object} odds - Payout table for symbol combinations
     * @returns {Object} - Complete result package {result: board[], settlementResult: {...}}
     */
    generateSettlementResult(player, bet, odds) {
        // Step 1: Generate the game board (potentially with admin cheating)
        const result = this.generateResult(bet.name);

        // Step 2: Calculate all wins, bonuses, free spins, and jackpot triggers
        const settlementResult = this.paylineCalculator.calculate(result, bet.paylines, odds);

        // Step 3: Generate jackpot prizes if jackpot was triggered
        const prizes = this.settleJackpot(player, settlementResult);

        // Step 4: Prepare jackpot data for client if triggered
        if (prizes?.length > 0) {
            settlementResult.jackpot = {
                prizes,                    // Array of prize tier options
                picked: false,            // Client hasn't chosen yet
                winningLine: settlementResult.jackpotPayline,  // Which payline triggered jackpot
                winningAmount: 0          // To be set after client chooses prize
            };
        }

        // Step 5: Filter out jackpot payline from regular wins (handled separately)
        settlementResult.winningPaylines = this.settleWinningPaylines(settlementResult);

        return { result, settlementResult };
    }

    /**
     * GENERATE RAW GAME BOARD - Core Randomization Logic
     *
     * Creates the 5x3 symbol board that determines the game outcome.
     * Applies difficulty-based RTP control and admin testing overrides.
     *
     * Board Generation Process:
     * 1. **Difficulty Selection**: Get player's chosen difficulty (easy/medium/hard)
     * 2. **Random Generation**: Create board using weighted symbol probabilities
     * 3. **Admin Override**: Apply any admin-defined board cheating
     *
     * RTP Control: Different difficulties have different symbol weight distributions
     * - Easy: Higher RTP (more wins, lower volatility)
     * - Medium: Balanced RTP (standard casino odds)
     * - Hard: Lower RTP (fewer wins, higher volatility)
     *
     * @param {string} playerName - Player identifier for admin override lookup
     * @returns {Array} - 15-symbol board array representing the 5x3 grid
     */
    generateResult(playerName) {
        // Get player's difficulty setting (controls RTP)
        const { mode } = this.gameData.gameConfigs.slotsConfig;

        // Generate board with difficulty-appropriate symbol weights
        const board = this.boardGenerator.generate(mode);

        // Apply any admin-defined board override for testing
        return this.boardCheatingConsumer.consume(playerName, board);
    }

    /**
     * FILTER WINNING PAYLINES - Separate Jackpot from Regular Wins
     *
     * Filters paylines to only include actual winning combinations.
     * Special handling for jackpots which are processed separately.
     *
     * Why Separate Jackpot Paylines?
     * - Jackpots involve multi-step client interaction (prize wheel)
     * - They have special payout calculations (progressive pools)
     * - They require different UI treatment than regular wins
     *
     * @param {Object} settlementResult - Complete win calculation result
     * @returns {Array} - Array of winning payline objects (excluding jackpot payline)
     */
    settleWinningPaylines(settlementResult) {
        // If jackpot was triggered, exclude that payline from regular wins
        return settlementResult.jackpot
            ? settlementResult.paylines.filter((payline) => payline.odds > 0 && payline.payline !== settlementResult.jackpotPayline)
            : settlementResult.paylines.filter((payline) => payline.odds > 0);
    }

    /**
     * GENERATE BONUS CHESTS - Interactive Mini-Game Setup
     *
     * Creates the set of bonus chests for the interactive bonus mini-game.
     * Called when a bonus feature is triggered by special symbols.
     *
     * Bonus Mini-Game Flow:
     * 1. Player gets 3+ bonus symbols in any column
     * 2. System generates 10 random prize chests
     * 3. Player opens chests manually to collect prizes
     * 4. Game completes when required number of chests are opened
     *
     * Prize Scaling: Rewards players who bet on more paylines with higher potential prizes
     *
     * @param {Object} bet - Player's bet details
     * @param {Object} bonusConfig - Bonus game configuration (min/max rates)
     * @returns {Array} - Array of bonus chest objects with random prizes
     */
    generateBonus(bet, bonusConfig) {
        return this.bonusBoardGenerator.generate(bet.bet, bonusConfig.min, bonusConfig.max, bet.paylines.length);
    }

    /**
     * SETTLE JACKPOT PRIZES - Progressive Jackpot Wheel Creation
     *
     * Generates the prize wheel when a jackpot is triggered.
     * Only called when player gets 5 jackpot symbols in a single payline.
     *
     * Jackpot Process:
     * 1. Player hits 5 jackpot symbols (symbol 10) in one payline
     * 2. System generates 10 potential prize tiers (Grand/Major/Minor)
     * 3. Client spins wheel to select final prize
     * 4. Selected tier determines which progressive pool is won
     *
     * @param {Object} player - Player session data
     * @param {Object} settlementResult - Win calculation result
     * @returns {Array|null} - Array of prize tier options or null if no jackpot
     */
    settleJackpot(player, settlementResult) {
        // Check if jackpot was triggered (jackpotPayline >= 0 means jackpot won)
        if (settlementResult.jackpotPayline > -1) {
            // Generate prize wheel with player's eligible tiers
            return this.jackpotPrizeGenerator.generate(player);
        }

        return null;  // No jackpot triggered
    }
}
