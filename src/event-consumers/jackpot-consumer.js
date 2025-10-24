import math from "lodash/math";
import mongoose from "mongoose";
import JackpotValidator from "../validators/jackpot-validator";
import { JackpotPublisher } from "./../event-publishers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

/**
 * JACKPOT CONSUMER - Progressive Jackpot Pool Manager
 *
 * PURPOSE:
 * Manages progressive jackpot pools that grow with every bet placed.
 * Handles jackpot wins, pool initialization, contribution calculations, and winner notifications.
 *
 * JACKPOT SYSTEM OVERVIEW:
 * - Multiple jackpot tiers (Grand, Major, Minor) with different contribution rates
 * - Pools grow progressively until won by a lucky player
 * - Separate contribution rates for real players vs bots
 * - Pools reset and start growing again after being won
 *
 * BUSINESS MODEL:
 * - Jackpots create excitement and aspiration for big wins
 * - Progressive nature encourages continued play
 * - High visibility jackpot amounts attract new players
 * - Controlled contribution rates ensure sustainable payouts
 */
export default class JackpotConsumer {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {JackpotPublisher} jackpotPublisher
     * @param {logger} logService
     * @param {mongoose.Model} jackpotsRepository
     * @param {JackpotValidator} jackpotValidator
     */
    constructor(definition, gameData, jackpotPublisher, logService, jackpotsRepository, jackpotValidator) {
        this.definition = definition;
        this.gameData = gameData;
        this.jackpotPublisher = jackpotPublisher;
        this.logService = logService;
        this.jackpotsRepository = jackpotsRepository;
        this.jackpotValidator = jackpotValidator;
    }

    /**
     * CONTRIBUTE TO JACKPOT POOLS - Add to Progressive Jackpots
     *
     * Every bet contributes a portion to all active jackpot pools.
     * This is how jackpots grow progressively over time.
     *
     * Contribution Logic:
     * 1. Check if player is eligible to contribute
     * 2. Calculate base contribution amount
     * 3. Add contribution to each jackpot pool (Grand, Major, Minor)
     *
     * @param {Object} player - Player session data
     * @param {Object} params - Contribution parameters
     * @param {number} params.totalAmount - Total bet amount
     * @param {number} params.roundId - Current round ID
     * @param {number} params.rate - Currency exchange rate
     * @param {boolean} params.freeSpin - Whether this is a free spin bet
     */
    async contribute(player, { totalAmount, roundId, rate, freeSpin }) {
        // Determine if this is a real player (not bot)
        const contributedByMember = !!player.session;

        // Validate contribution eligibility
        if (contributedByMember && !this.jackpotValidator.canContributeJackpotPools(player, freeSpin)) {
            return;  // Free spins may be excluded from jackpot contributions
        }

        // Get jackpot pool configurations
        const { pools } = this.gameData.gameConfigs.slotsConfig.jackpot;

        // Calculate contribution amount in base currency
        const baseTotalAmount = totalAmount * rate;
        const jackpotPrizes = Object.keys(pools);  // ['grand', 'major', 'minor']

        // Contribute to each jackpot pool
        for (const prize of jackpotPrizes) {
            await this.contributeToPool({
                baseTotalAmount,
                contributedByMember,
                prize,
                roundId,
                pool: pools[prize]
            });
        }
    }

    /**
     * CONTRIBUTE TO SPECIFIC JACKPOT POOL
     *
     * Atomic operation to add contribution to a single jackpot pool.
     * Uses MongoDB atomic operations for thread safety.
     *
     * Pool Update Process:
     * 1. Calculate contribution amount based on player type
     * 2. Find the current running pool for this prize tier
     * 3. Atomically increment the pool amount
     * 4. Publish updated pool amount to all clients
     *
     * @param {Object} params - Pool contribution parameters
     * @param {number} params.baseTotalAmount - Bet amount in base currency
     * @param {boolean} params.contributedByMember - Real player vs bot
     * @param {string} params.prize - Pool type ('grand', 'major', 'minor')
     * @param {number} params.roundId - Current round ID
     * @param {Object} params.pool - Pool configuration with contribution rates
     */
    async contributeToPool({ baseTotalAmount, contributedByMember, prize, roundId, pool }) {
        // Calculate how much to add to this pool
        const poolAdjustment = this.calculatePoolAdjustment({
            contributedByMember,
            poolConfig: pool,
            baseTotalAmount
        });

        // Find the currently running pool for this prize tier
        const runningPoolFilter = {
            gameId: this.definition.id,
            prize: prize,
            winnerName: { $exists: false },  // Pool hasn't been won yet
            createdAt: { $lte: roundId },     // Pool was created before/at this round
        };

        const sortByNewest = { createdAt: -1 };

        // Atomically increment pool and get new amount
        const latestJackpotProjection = { _id: false, amount: true };
        const latestJackpotPool = await this.jackpotsRepository.findOneAndUpdate(
            runningPoolFilter,
            {
                gameId: this.definition.id,
                $inc: poolAdjustment,  // Atomic increment operation
            },
            {
                new: true,           // Return updated document
                lean: true,          // Fast query without mongoose overhead
                fields: latestJackpotProjection,  // Only return amount field
                sort: sortByNewest,  // Get most recent pool
            }
        );

        // Broadcast updated pool amount to all connected clients
        this.jackpotPublisher.publishLatestPool({
            pool: prize,
            amount: latestJackpotPool.amount
        });
    }

    /**
     * CALCULATE POOL CONTRIBUTION AMOUNT
     *
     * Determines how much of a bet contributes to jackpot pools.
     * Different contribution rates for real players vs bots.
     *
     * Contribution Rate Logic:
     * - Real players: Use playerSettings.contrib rate
     * - Bots: Use botSettings.contrib rate (typically lower)
     * - Amount = betAmount × contributionRate
     *
     * Example: $10 bet with 1% contribution = $0.10 added to pool
     *
     * @param {Object} params - Calculation parameters
     * @param {boolean} params.contributedByMember - Real player vs bot
     * @param {Object} params.poolConfig - Pool configuration with rates
     * @param {number} params.baseTotalAmount - Bet amount in base currency
     * @returns {Object} - Contribution breakdown for database update
     */
    calculatePoolAdjustment({ contributedByMember, poolConfig, baseTotalAmount }) {
        // Select contribution rate based on player type
        const contributionRatio = contributedByMember
            ? poolConfig.playerSettings.contrib   // Real player rate
            : poolConfig.botSettings.contrib;     // Bot rate

        // Calculate actual contribution amount
        const contributionAmount = math.round(baseTotalAmount * contributionRatio, 4);

        return {
            amount: contributionAmount,           // Total added to pool
            byBots: contributedByMember ? 0 : contributionAmount,      // Bot contribution
            byMembers: contributedByMember ? contributionAmount : 0,   // Player contribution
        };
    }

    /**
     * JACKPOT WIN PROCESSING - Award Progressive Jackpot
     *
     * Handles the complete jackpot win process when a player hits 5 jackpot symbols.
     * This is the moment of truth - awarding life-changing prizes!
     *
     * Win Processing Steps:
     * 1. Find the winning pool and mark it as won
     * 2. Apply winning ratio multiplier to pool amount
     * 3. Initialize new pool for continued growth
     * 4. Publish winner announcement to all players
     * 5. Return final winning amount
     *
     * @param {Object} player - Winning player data
     * @param {Object} params - Jackpot win parameters
     * @param {string} params.prize - Which pool was won ('grand', 'major', 'minor')
     * @param {number} params.roundId - Round when jackpot was hit
     * @param {string} params.exchangeRateId - Currency exchange reference
     * @param {number} params.rate - Currency conversion rate
     * @param {string} params.operatorId - Operator identifier
     * @param {string} params.currency - Player's currency
     * @returns {Object} - Winning amount details
     */
    async hit(player, { prize, roundId, exchangeRateId, rate, operatorId, currency }) {
        // Get the winning ratio (usually 1.0 = 100% of pool amount)
        const winningRatio = this.gameData.gameConfigs.slotsConfig.jackpot.winningRatio;

        // Find the pool that was just won
        const runningPoolFilter = this.getRunningPoolFilter(prize, roundId);
        const sortByNewest = { createdAt: -1 };

        // Prepare winner information to record in database
        const winnerAdjustment = this.getWinnerAdjustment({
            winningRatio,
            player,
            roundId,
            exchangeRateId,
            rate,
            currency,
            operatorId
        });

        // Update pool document to mark it as won
        const winnerProjection = {
            _id: false,
            pool: true,
            winnerName: true,
            amount: true,
        };

        const winningJackpot = await this.jackpotsRepository.findOneAndUpdate(
            runningPoolFilter,
            {
                $set: winnerAdjustment,  // Mark pool as won with winner details
            },
            {
                new: true,           // Return updated document
                lean: true,          // Fast query
                fields: winnerProjection,
                sort: sortByNewest,
            }
        );

        // Immediately start a new pool for this prize tier
        await this.initializeNewPool(prize, roundId);

        if (!winningJackpot) {
            this.logService.logCritical(
                `Couldn't find any running jackpot pool associated with: ${JSON.stringify(runningPoolFilter)}`
            );
            return { amount: 0 };
        }

        // Apply winning ratio to determine final payout
        winningJackpot.amount *= winningRatio;

        // Announce winner to all connected clients
        await this.jackpotPublisher.publishWinner(player.UID, {
            ...winningJackpot,
            pool: prize
        });

        return winningJackpot;
    }

    /**
     * PREPARE WINNER RECORDING DATA
     *
     * Creates the data structure to record jackpot win details in database.
     * This information is used for auditing, statistics, and player history.
     *
     * @param {Object} params - Winner information parameters
     * @returns {Object} - Database update object for winner recording
     */
    getWinnerAdjustment({ winningRatio, player, roundId, exchangeRateId, rate, currency, operatorId }) {
        return {
            winningRatio,                    // Multiplier applied to pool amount
            winnerName: player.profile.name, // Player's display name
            winnerId: player.session?.playerId, // Internal player ID (null for bots)
            hitAt: roundId,                  // Round when jackpot was won
            hitTime: new Date(),             // Timestamp of win
            exchangeRateId,                  // Currency conversion reference
            rate,                            // Exchange rate at time of win
            currency,                        // Player's currency
            operatorId,                      // Casino operator identifier
        };
    }

    getRunningPoolFilter(prize, roundId) {
        return {
            gameId: this.definition.id,
            prize,
            winnerName: { $exists: false },
            createdAt: { $lt: roundId },
        };
    }

    /**
     * INITIALIZE JACKPOT SYSTEM - Setup Progressive Pools
     *
     * Called when the game server starts up. Ensures all jackpot pools exist
     * and are ready for contributions. Critical for system startup.
     *
     * Initialization Process:
     * 1. Check if jackpot feature is enabled in configuration
     * 2. Verify all required pool configurations exist
     * 3. For each prize tier (grand, major, minor):
     *    - Check if a running pool already exists
     *    - Create new pool if none exists
     *    - Log warnings for duplicate pools
     *
     * This prevents the system from starting without proper jackpot infrastructure.
     */
    async initialize() {
        // Get jackpot pool configurations from game settings
        const { pools } = this.gameData.gameConfigs.slotsConfig.jackpot;

        // Validate jackpot configuration exists
        if (pools === null || pools === undefined) {
            this.logService.logCritical(`NOT FOUND jackpot pools configurations of ${this.gameData.gameConfigs.name}`);
            return;
        }

        const roundId = this.gameData.roundId;
        const prizes = Object.keys(pools);  // ['grand', 'major', 'minor']

        // Initialize all prize pools in parallel
        await Promise.all(
            prizes.map(async (prize) => {
                // Check for existing running pools for this prize tier
                const runningPoolFilter = {
                    gameId: this.definition.id,
                    prize: prize,
                    winnerName: { $exists: false },  // Not yet won
                };
                const numberOfExistingPools = await this.jackpotsRepository.countDocuments(runningPoolFilter).exec();

                if (numberOfExistingPools === 0) {
                    // No running pool exists - create new one
                    await this.initializeNewPool(prize, roundId);
                    return;
                }

                // Multiple running pools indicate a system issue
                this.logService.logCritical(`Found ${numberOfExistingPools} running jackpot pool for prize ${prize}`);
            })
        );
    }

    async initializeNewPool(prize, roundId) {
        const { pools } = this.gameData.gameConfigs.slotsConfig.jackpot;
        const initAmount = pools[prize].init;

        this.logService.log(`Init new jackpot prize ${prize} at round ${roundId}`);

        await this.jackpotsRepository.create({
            gameId: this.definition.id,
            gameName: this.definition.name,
            prize: prize,
            initAmount,
            amount: initAmount,
            createdAt: roundId,
            createdTime: new Date(),
        });
    }

    async getLatestRoundId() {
        const runningPoolFilter = {
            gameId: this.definition.id,
            winnerName: { $exists: false },
        };

        const pool = await this.jackpotsRepository
            .findOne(runningPoolFilter, "createdAt", {
                sort: {
                    createdAt: -1,
                },
            })
            .lean()
            .exec();

        return pool ? pool.createdAt : 0;
    }
}
