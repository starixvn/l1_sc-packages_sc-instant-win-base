import math from "lodash/math";
import { helpers } from "sc-common";
import { Core } from "sc-game-base";
import defaultDefinition from "../board/default-definition";
import { MultipleCurrencyHelper } from "./../helpers";
import SlotNoticeHelper from "./../helpers/slot-notice-helper";

/**
 * PLACE BET CONSUMER - Bet Validation & Queue Management
 *
 * PURPOSE:
 * Handles player bet placement, validates bet amounts and timing,
 * manages the betting queue, and prepares player data for game rounds.
 *
 * KEY FEATURES:
 * - Bet amount distribution across 25 paylines
 * - Multi-currency bet level validation
 * - Player session tracking and initialization
 * - Free spin bet handling
 *
 * BET FLOW:
 * 1. Player sends bet request with total amount
 * 2. System distributes amount evenly across 25 paylines
 * 3. Validates bet against configured stake levels
 * 4. Queues bet for round processing
 */
export default class PlaceBetConsumer extends Core.BaseEventConsumers.PlaceBetConsumer {
    /**
     * @param {Object} definition - Game definition
     * @param {Object} gameData - Runtime game state
     * @param {Object} publisher - Event publisher
     * @param {Object} logService - Logging service
     * @param {Object} boardDefinition - Board configuration (25 paylines)
     */
    constructor(definition, gameData, publisher, logService, boardDefinition) {
        super(definition, gameData, publisher, logService);
        this.boardDefinition = boardDefinition ?? defaultDefinition;
    }

    /**
     * VALIDATION: Game Timing
     * Ensures bets can only be placed when game is enabled
     */
    composeBettingTimeValidationCriteria(roundId) {
        const gameConfigs = this.gameData.gameConfigs;

        return [
            {
                failure: !gameConfigs.enabled,
                notice: this.getNoticeObj(helpers.noticeHelper.placeBetNextRound),
            },
        ];
    }

    /**
     * VALIDATION: Bet Amount
     * Validates bet amounts against configured stake levels per currency
     */
    composeBetAmountValidationCriteria(player, betChoice, amount, freeSpin) {
        const betLevels = MultipleCurrencyHelper.getBetLevels(this.gameData, player);

        return [
            {
                failure: amount <= 0,
                notice: this.getNoticeObj(SlotNoticeHelper.invalidStakeLevel),
            },
            {
                failure: !freeSpin && !betLevels.includes(amount),
                notice: this.getNoticeObj(SlotNoticeHelper.invalidStakeLevel),
            },
        ];
    }

    /**
     * VALIDATION: Bet Choice (unused for slots - always all paylines)
     */
    composeBetChoiceValidationCriteria(betChoice) {
        return [];
    }

    /**
     * VALIDATION: Hedge Bets (unused for slots)
     */
    composeHedgeBetValidationCriteria(betChoice, player) {
        return [];
    }

    /**
     * VALIDATION: Promotions (unused for slots)
     */
    composePromotionValidationCriteria(player) {
        return [];
    }

    /**
     * MAIN BET PROCESSING
     *
     * Bet Distribution Logic:
     * - Player bets total amount (e.g., $25)
     * - System divides by 25 paylines = $1 per payline
     * - Each payline bet individually validated and queued
     *
     * Free Spin Handling:
     * - Free spins use stored bet configurations
     * - Bypass normal stake level validation
     */
    async consume(player, payload) {
        // BET DISTRIBUTION: Divide total bet across all 25 paylines
        Object.assign(payload, {
            amount: math.round(payload.amount / this.boardDefinition.paylines.length, 4),
            freeBet: payload.freeBet ?? false,
            freeSpin: payload.freeSpin ?? false,
            betChoice: Object.keys(this.boardDefinition.paylines),  // [0,1,2,...,24]
        });

        const { amount, betChoice, freeSpin, roundId } = payload;
        const name = player.profile.name;

        if (!this.validateBetRequest(player, betChoice, amount, freeSpin, roundId)) {
            return;
        }

        this.initializePlayerData(player, payload);
        this.adjustBetTracks(player.profile.name, payload);

        // QUEUE BET: Add to player's bet queue for round processing
        this.gameData.ingame[name].betQueue.push({ player, payload });
    }

    /**
     * PLAYER INITIALIZATION
     *
     * Creates player session data if first time playing:
     * - Profile information (name, avatar)
     * - Currency and system settings
     * - Bet tracking and queue management
     * - Client seed for provably fair gameplay
     */
    initializePlayerData(player, payload) {
        const name = player.profile.name;

        if (!this.gameData.ingame[name]) {
            const newPlayer = {
                name: player.profile.name,
                avatarId: player.profile.avatarId,
                currency: player.session.currencyName,
                system: player.session.system,
                betTracks: {},          // Track bet patterns
                betQueue: [],           // Pending bets for current round
                clientSeed: payload.clientSeed,  // For provably fair randomization
                operatorId: player.session.operatorId,
            };

            // Store promotion data if player has active promotions
            if (player.promotion) {
                newPlayer.promotion = { ...player.promotion };
            }

            this.gameData.ingame[name] = newPlayer;
        }
    }
}
