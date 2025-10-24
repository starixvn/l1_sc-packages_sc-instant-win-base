import mongoose from "mongoose";
import { Table } from "sc-game-base";
import * as Board from "./../board";
import * as EventConsumers from "./../event-consumers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

/**
 * SLOT GAME BOT - Automated Player Simulation System
 *
 * PURPOSE:
 * Creates realistic automated players (bots) to maintain game activity and social atmosphere.
 * Bots simulate human player behavior with varying bet patterns and win announcements.
 *
 * BOT BEHAVIOR SIMULATION:
 * - **Realistic Betting**: Uses statistical distributions matching real player patterns
 * - **Variable Activity**: Bots place 1-3 bets per cycle to simulate human timing
 * - **Win Announcements**: Broadcasts bot wins to create social proof
 * - **Jackpot Participation**: Contributes to and wins jackpots like real players
 * - **Bet Level Distribution**: Maintains configured ratios across stake levels
 *
 * BUSINESS VALUE:
 * - Prevents empty tables and maintains game atmosphere
 * - Creates social proof through bot wins and activity
 * - Helps maintain jackpot pools through bot contributions
 * - Provides realistic game activity metrics
 */
export default class SlotGameBot extends Table.Crons.TableGameBot {
    /**
     * @param {Object} dependencies
     * @param {SlotGameDefinition} dependencies.definition
     * @param {SlotGameData} dependencies.gameData
     * @param {EventConsumers.JackpotConsumer} dependencies.jackpotConsumer
     * @param {EventConsumers.IdCountersConsumer} dependencies.idCountersConsumer
     * @param {EventConsumers.HallOfFameConsumer} dependencies.hallOfFameConsumer
     * @param {EventConsumers.BoardCheatingConsumer} dependencies.boardCheatingConsumer
     * @param {Board.BoardGenerator} dependencies.boardGenerator
     * @param {Board.PaylineCalculator} dependencies.paylineCalculator
     * @param {GameManagementApiClientFactory} dependencies.gameManagementApiClientFactory
     */
    constructor({
        definition,
        gameData,
        jackpotConsumer,
        idCountersConsumer,
        hallOfFameConsumer,
        boardCheatingConsumer,
        boardGenerator,
        paylineCalculator,
        publisher,
        appConfigs,
        gameManagementApiClientFactory,
    }) {
        super(definition, gameData, publisher, gameManagementApiClientFactory);

        this.idCountersConsumer = idCountersConsumer;
        this.jackpotConsumer = jackpotConsumer;
        this.hallOfFameConsumer = hallOfFameConsumer;
        this.boardCheatingConsumer = boardCheatingConsumer;
        this.boardGenerator = boardGenerator;
        this.paylineCalculator = paylineCalculator;

        this.totalNumberOfTickets = 0;
        this.odds = {};
        this.bigWinRatio = 0;
        this.groupTracks = [];
        this.appConfigs = appConfigs;
    }

    /**
     * STANDARDIZE BOT DATA - Convert Bot to Player Format
     *
     * Transforms bot data structure to match real player format.
     * This allows bots to use the same game logic as human players.
     *
     * @param {Object} bot - Raw bot data from bot management system
     * @returns {Object} - Standardized player-like object
     */
    standardizeBot(bot) {
        return {
            UID: bot.id,           // Bot ID as player ID
            profile: {
                name: bot.name,    // Bot display name
            },
        };
    }

    /**
     * INITIALIZE BOT STATISTICS - Setup Bet Distribution Tracking
     *
     * Configures statistical tracking to maintain realistic bet distributions.
     * Ensures bots bet at configured ratios across different stake levels.
     *
     * Bet Distribution Strategy:
     * - Divides bet levels into 4 groups with ratios: [50%, 30%, 15%, 5%]
     * - Tracks actual betting patterns vs target ratios
     * - Adjusts future bets to maintain distribution balance
     */
    resetAllBotData() {
        // Get configured bet levels (fallback to game defaults)
        const betLevelsConfigs = [...(this.appConfigs.baseBetLevels ?? this.gameData.gameConfigs.slotsConfig?.betLevels)] ?? [];

        // Reset tracking counters
        this.totalNumberOfTickets = 0;
        this.odds = this.gameData.gameConfigs.slotsConfig?.icons ?? {};
        this.bigWinRatio = this.gameData.gameConfigs.slotsConfig?.bigWinRatio ?? 3;

        // Target distribution ratios for different bet level groups
        const ratios = [50, 30, 15, 5];  // Percentage distribution goals

        const betLevelsPerGroup = Math.floor(betLevelsConfigs.length / ratios.length);

        // Create tracking groups for each bet level range
        this.groupTracks = ratios
            .map((ratio, index) => {
                // Distribute bet levels across groups (first group gets remainders)
                const length = index === 0
                    ? betLevelsPerGroup + (betLevelsConfigs.length % ratios.length)
                    : betLevelsPerGroup;

                return {
                    betLevels: betLevelsConfigs.splice(0, length),  // Bet levels in this group
                    ratio,                                          // Target percentage
                    numberOfTickets: 0,                            // Actual bets placed
                };
            })
            .filter((x) => x.betLevels.length > 0);  // Remove empty groups

        super.resetAllBotData();  // Call parent initialization
    }

    /**
     * SIMULATE BOT BETTING - Complete Game Round Simulation
     *
     * Simulates a complete betting cycle for a bot, including:
     * - Board generation with bot-specific probabilities
     * - Win calculation and jackpot participation
     * - Win announcements with realistic timing delays
     * - Statistical tracking for bet distribution
     *
     * Multi-Bet Simulation:
     * Bots place 1-3 bets per cycle to simulate human behavior patterns.
     * Each bet is spaced with delays to create realistic activity.
     *
     * @param {Object} bot - Bot player data
     */
    async placeBet(bot) {
        const standardizedBot = this.standardizeBot(bot);
        const { jackpot } = this.gameData.gameConfigs.slotsConfig;
        const name = standardizedBot.profile.name;

        // Setup bet parameters
        const numberOfPaylines = this.boardGenerator.numberOfPaylines;
        const paylines = [...Array(numberOfPaylines).keys()];  // [0,1,2,...,24]
        const amount = bot.selectedBetLevel;  // Bot's chosen bet amount
        const totalAmount = amount * numberOfPaylines;  // Total bet across all paylines
        const track = this.groupTracks.find((track) => track.betLevels.includes(amount));

        // Simulate 1-3 bets per cycle (realistic human behavior)
        for (let i = 0; i < this.chance.integer({ min: 1, max: 3 }); i++) {
            // Generate new round ID for each bet
            await this.increaseRoundId();
            const roundId = this.gameData.roundId;

            // Generate board with bot-specific jackpot probability
            const generatedBoard = this.boardGenerator.generateForBots(jackpot.enabled, track.ratio);
            const board = this.boardCheatingConsumer.consume(name, generatedBoard);

            // Calculate wins using same logic as real players
            const betResult = this.paylineCalculator.calculate(board, paylines, this.odds);
            const winningAmount = betResult.paylines.reduce(
                (currentWinningAmount, payline) => currentWinningAmount + payline.odds * amount,
                0
            );

            // JACKPOT PROCESSING (if enabled)
            if (jackpot.enabled) {
                // Check for jackpot win
                if (betResult.jackpotPayline >= 0) {
                    // Select jackpot tier based on bot allocation weights
                    const prize = this.chance.weighted(
                        Object.keys(jackpot.pools),    // ['grand', 'major', 'minor']
                        Object.values(jackpot.pools).map((pool) => pool.botSettings.alloc)  // Allocation weights
                    );

                    // Process jackpot win
                    await this.jackpotConsumer.hit(standardizedBot, {
                        prize,
                        roundId,
                        exchangeRateId: this.gameData.exchangeRates.exId,
                        rate: this.botRate,
                    });
                }

                // Contribute to jackpot pools (all bets contribute)
                await this.jackpotConsumer.contribute(standardizedBot, {
                    totalAmount,
                    roundId,
                    rate: this.botRate
                });
            }

            // WIN ANNOUNCEMENT (if bot won anything)
            if (winningAmount > 0) {
                // Delay announcements to simulate realistic timing
                // i * 300ms creates staggered announcements for multi-bet cycles
                setTimeout(() => {
                    this.publisher.publishToAllUsers({
                        winner: {
                            id: bot.id,
                            name: bot.name,
                            avatarId: bot.avatarId,
                            betWin: winningAmount,
                            bigWin: totalAmount * this.bigWinRatio <= winningAmount,  // Big win check
                            rate: this.botRate,
                        },
                    });
                }, i * 300);  // Progressive delays: 0ms, 300ms, 600ms
            }

            // Update statistical tracking
            this.adjustGroupTracks(amount);
        }
    }

    async increaseRoundId() {
        await this.idCountersConsumer.consume("round");
        this.gameData.roundId++;
    }

    /**
     * SELECT BOT BET AMOUNT - Statistical Bet Distribution
     *
     * Chooses bet amounts based on statistical tracking to maintain target distributions.
     * Prioritizes bet levels that are below their target ratios to balance overall patterns.
     *
     * Selection Algorithm:
     * 1. Check which bet level groups are below their target ratios
     * 2. Prefer under-ratio groups to correct imbalances
     * 3. Fall back to random selection if all ratios are balanced
     * 4. Randomly select specific bet level within chosen group
     *
     * @returns {number} - Selected bet amount for bot
     */
    getBetAmount() {
        // Calculate current ratios vs targets for each group
        const ratiosPerGroup = this.groupTracks.map((track) => {
            return {
                betLevels: track.betLevels,
                underRatio: (track.numberOfTickets * 100) / this.totalNumberOfTickets < track.ratio,
            };
        });

        // Prioritize groups that need more bets to reach target ratio
        const underRatioGroups = this.chance.shuffle(
            ratiosPerGroup.filter((group) => group.underRatio)
        );

        // Select group: under-ratio first, then random fallback
        const selectedGroup = underRatioGroups.length > 0
            ? underRatioGroups[0]
            : this.randomizeGroup();

        // Randomly pick specific bet level within selected group
        return this.chance.pickone(selectedGroup.betLevels);
    }

    randomizeGroup() {
        const randomIndex = this.chance.natural({ min: 0, max: this.groupTracks.length - 1 });

        return this.groupTracks[randomIndex];
    }

    adjustGroupTracks(betAmount) {
        const group = this.groupTracks.find((track) => track.betLevels.includes(betAmount));

        if (group) {
            group.numberOfTickets++;
        }

        this.totalNumberOfTickets++;
    }

    addToPlayersAndPublish(bot) {
        this.gameData.players[bot.id] = bot;
    }

    async removeBot(botId) {
        await this.gameManagementApiClient.users.updateBotsOutRoom({ botIds: [botId] });
        delete this.gameData.players[botId];
    }

    async botJoinRoom(bot) {
        bot.selectedBetLevel = this.getBetAmount();
        await super.botJoinRoom(bot);
    }
}
