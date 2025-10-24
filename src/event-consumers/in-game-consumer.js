import mongoose from "mongoose";
import { Core, Table } from "sc-game-base";

import math from "lodash/math";
import defaultDefinition from "../board/default-definition";
import { MultipleCurrencyHelper } from "./../helpers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
import FreeSpinsConsumer from "./free-spins-consumer";
import ProgressBonusConsumer from "./progress-bonus-consumer";

/**
 * IN-GAME CONSUMER - Active Player State Management
 *
 * PURPOSE:
 * Manages players who are actively connected to the game, providing them with
 * real-time game state, configuration, and feature availability information.
 *
 * RESPONSIBILITIES:
 * - **Game State Sync**: Send current game configuration to connected players
 * - **Feature Status**: Provide free spins, bonus progress, jackpot pools
 * - **Balance Updates**: Keep players informed of their current balance
 * - **Eligibility Checks**: Filter features based on player permissions
 * - **Real-time Updates**: Maintain live connection with active players
 *
 * INITIALIZATION FLOW:
 * 1. Player connects to game → InGameConsumer triggered
 * 2. Validate game is enabled (not in maintenance)
 * 3. Build comprehensive payload with all game state
 * 4. Send initial game configuration to player's client
 * 5. Register player in active player list
 *
 * KEY DATA PROVIDED TO CLIENT:
 * - Game configuration (bet levels, odds table, jackpot settings)
 * - Current jackpot pool amounts
 * - Available free spins information
 * - Bonus game progress status
 * - Player balance and currency information
 */
export default class InGameConsumer extends Table.EventConsumers.TableInGameConsumer {
    /**
     * @param {Object} dependencies
     * @param {SlotGameDefinition} dependencies.definition
     * @param {SlotGameData} dependencies.gameData
     * @param {Core.QueryApis.RoundQuery} dependencies.roundQuery
     * @param {Core.BaseEventPublishers.BaseEventPublisher} dependencies.publisher
     * @param {FreeSpinsConsumer} dependencies.freeSpinsConsumer
     * @param {ProgressBonusConsumer} dependencies.progressBonusConsumer
     * @param {getBalanceApi} dependencies.getBalance
     * @param {mongoose.Model} dependencies.jackpotsRepository
     * @param {GameManagementApiClientFactory} dependencies.gameManagementApiClientFactory
     * @param {UserTrackingClient} dependencies.userTrackingClient
     */
    constructor({
        definition,
        gameData,
        roundQuery,
        publisher,
        freeSpinsConsumer,
        progressBonusConsumer,
        getBalance,
        jackpotsRepository,
        jackpotValidator,
        boardDefinition,
        gameManagementApiClientFactory,
        userTrackingClient,
    }) {
        super(definition, gameData, roundQuery, publisher, getBalance, gameManagementApiClientFactory, userTrackingClient);

        this.freeSpinsConsumer = freeSpinsConsumer;
        this.progressBonusConsumer = progressBonusConsumer;
        this.jackpotsRepository = jackpotsRepository;
        this.jackpotValidator = jackpotValidator;
        this.boardDefinition = boardDefinition ?? defaultDefinition;
    }

    /**
     * HANDLE PLAYER CONNECTION - Main Entry Point
     *
     * Called when a player connects to or joins the game.
     * Provides the player with all necessary information to start playing.
     *
     * Process Flow:
     * 1. **Maintenance Check**: Verify game is not disabled
     * 2. **State Building**: Gather all player-specific game state
     * 3. **Player Registration**: Add to active player list
     * 4. **Data Transmission**: Send complete game state to client
     *
     * Maintenance Mode: If game is disabled, sends maintenance message
     * instead of game data to prevent player confusion.
     *
     * @param {Object} realPlayer - Connected player with session and socket info
     */
    async consume(realPlayer) {
        // Check if game is in maintenance mode
        const { gameConfigs, umMessages } = this.gameData;
        const disabled = !gameConfigs || !gameConfigs.enabled;
        if (disabled) {
            // Send maintenance message instead of game data
            realPlayer.socketClient.emit(this.definition.name, { um: disabled, um_message: umMessages });
            return;
        }

        // Build comprehensive game state payload
        const payload = await this.buildPayload(realPlayer);

        // Extract player info for active player tracking
        const { red, avatarId, type, rate } = payload.user;
        const player = {
            id: realPlayer.UID,
            name: realPlayer.profile.name,
            red,        // Balance in display currency
            avatarId,   // Player's avatar for display
            type,       // Player type (real/bot)
            rate,       // Currency exchange rate
        };

        // Register player in active player list (if not already present)
        if (!this.gameData.players[realPlayer.UID]) {
            this.gameData.players[realPlayer.UID] = player;
        }

        // Send complete game initialization data to client
        realPlayer.socketClient.emit(this.definition.name, payload);
    }

    /**
     * BUILD INITIALIZATION PAYLOAD - Gather Complete Game State
     *
     * Constructs the comprehensive data package sent to newly connected players.
     * Includes all information needed for the client to render the game interface.
     *
     * Data Categories:
     * - **Game Configuration**: Bet levels, odds, jackpot settings
     * - **Feature Status**: Free spins, bonus progress, jackpot pools
     * - **Player Info**: Balance, avatar, currency settings
     *
     * Eligibility Filtering: Different data based on player permissions
     * (e.g., jackpot-disabled players don't get pool information)
     *
     * @param {Object} realPlayer - Player session data
     * @returns {Object} - Complete initialization payload for client
     */
    async buildPayload(realPlayer) {
        const { session } = realPlayer;

        // Check player's jackpot eligibility (based on location, preferences, etc.)
        const canAccessJackpot = this.jackpotValidator.canAccessJackpot(realPlayer);

        // Gather all game configuration and status data
        const gameConfigs = this.getSlotGameConfig(realPlayer, canAccessJackpot);
        const freeSpins = this.getAvailableFreeSpins(realPlayer);
        const progressBonus = this.progressBonusConsumer.getProgressBonusStatus(realPlayer);
        const jackpotPools = canAccessJackpot ? await this.getPools() : [];  // Only if eligible

        // Fetch current player balance
        await this.getBalance(realPlayer, true);

        // Get detailed user information
        const user = await this.getUserInfo(realPlayer.UID);

        // Calculate currency exchange rates
        const { rate, multiplier } = this.getExchangeRate(session);

        // Return complete payload with all game state
        return {
            gameConfigs,      // Bet levels, odds table, jackpot config
            jackpotPools,     // Current progressive pool amounts
            freeSpins,        // Available free spin information
            progressBonus,    // Bonus game progress status
            user: {
                ...user,      // Balance, avatar, account info
                rate,         // Currency exchange rate
                multiplier,   // Currency multiplier
                disableJackpotGames: session.disableJackpotGames,  // User preference
            },
        };
    }

    /**
     * GET SLOT GAME CONFIGURATION - Player-Specific Game Settings
     *
     * Builds the game configuration object sent to the client, customized
     * based on player's currency, eligibility, and permissions.
     *
     * Configuration Includes:
     * - **Bet Levels**: Available stake amounts (per payline × 25 paylines)
     * - **Default Bet**: Recommended starting bet amount
     * - **Odds Table**: Payout multipliers for all symbol combinations
     * - **Jackpot Config**: Pool contribution rates (if player eligible)
     *
     * Currency Impact: Bet levels are converted to player's display currency
     * and scaled by total paylines (25) for total bet amount display.
     *
     * @param {Object} realPlayer - Player session data
     * @param {boolean} canAccessJackpot - Whether player can see jackpot features
     * @returns {Object} - Game configuration for client
     */
    getSlotGameConfig(realPlayer, canAccessJackpot) {
        // Convert per-payline bet levels to total bet amounts (25 paylines)
        const betLevels = MultipleCurrencyHelper.getBetLevels(this.gameData, realPlayer).map((x) =>
            math.round(x * this.boardDefinition.paylines.length, 2)  // $1/payline × 25 = $25 total
        );

        // Calculate default bet level in total amount
        const defaultBetLevel = math.round(
            MultipleCurrencyHelper.getDefaultBetLevel(this.gameData, realPlayer) * this.boardDefinition.paylines.length,
            2
        );

        // Get core game configuration
        const { icons: odds, jackpot } = this.gameData.gameConfigs.slotsConfig;

        return {
            betLevels,        // [25, 50, 75, 100, ...] - total bet amounts
            defaultBetLevel,  // Recommended starting bet
            odds,            // Symbol payout table
            jackpot: canAccessJackpot
                ? {
                      winningRatio: jackpot.winningRatio,  // Jackpot payout multiplier
                      pools: this.getJackpotPoolsConfig(jackpot.pools),  // Contribution rates
                  }
                : {},  // Empty object for ineligible players
        };
    }

    getJackpotPoolsConfig(pools) {
        const poolConfigs = [];

        Object.keys(pools).forEach((prize) => {
            const config = { pool: prize, contribute: pools[prize].playerSettings.contrib };
            poolConfigs.push(config);
        });

        return poolConfigs;
    }

    getAvailableFreeSpins(realPlayer) {
        const totalOfFreeSpins = this.freeSpinsConsumer.getTotalAvaiableFreeSpins(realPlayer);
        const soonestExpiredFreeSpinSet = this.freeSpinsConsumer.getSoonestExpiredFreeSpinSet(realPlayer) ?? { bet: 0, paylines: [] };

        return {
            total: totalOfFreeSpins,
            bet: soonestExpiredFreeSpinSet.bet,
            paylines: soonestExpiredFreeSpinSet.paylines,
        };
    }

    async getPools() {
        const runningPoolsFilter = {
            gameId: this.definition.id,
            winnerName: { $exists: false },
        };
        const projection = {
            _id: false,
            pool: "$prize",
            amount: true,
        };

        return this.jackpotsRepository.find(runningPoolsFilter, projection).lean().exec();
    }

    getExchangeRate(session) {
        const { exchangeRates } = this.gameData;
        const { multiplier, currencyCode } = session;
        const rate = exchangeRates.code[currencyCode] * multiplier;

        return { rate, multiplier };
    }
}
