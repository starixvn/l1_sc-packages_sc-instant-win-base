import Chance from "chance";
import moment from "moment";

import { BonusPublisher } from "./../event-publishers";
import SlotNoticeHelper from "./../helpers/slot-notice-helper";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
import SettleGameRoundConsumer from "./settle-game-round-consumer";

/**
 * BONUS CONSUMER - Interactive Bonus Mini-Game Manager
 *
 * PURPOSE:
 * Manages the bonus mini-game where players open virtual chests to win prizes.
 * Handles chest selection, validation, auto-opening expired games, and game completion.
 *
 * BONUS MINI-GAME FLOW:
 * 1. Player triggers bonus by getting 3+ bonus symbols in any column
 * 2. 3-10 random prize chests are generated (based on bonus trigger)
 * 3. Player manually opens chests to collect prizes
 * 4. Game completes when all required chests are opened
 * 5. Auto-opens remaining chests if player abandons game (125 second timeout)
 *
 * BUSINESS VALUE:
 * - Increases player engagement and session time
 * - Provides additional win opportunities
 * - Creates excitement with random prize reveals
 * - Social proof through chest-opening animations
 */
export default class BonusConsumer {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {BonusPublisher} bonusPublisher
     * @param {SettleGameRoundConsumer} settleGameRoundConsumer
     */
    /**
     * @param {SlotGameDefinition} definition - Game configuration with bonus settings
     * @param {SlotGameData} gameData - Runtime game state
     * @param {BonusPublisher} bonusPublisher - Publishes bonus events to clients
     * @param {SettleGameRoundConsumer} settleGameRoundConsumer - Handles game settlement
     */
    constructor(definition, gameData, bonusPublisher, settleGameRoundConsumer) {
        this.definition = definition;
        this.gameData = gameData;
        this.bonusPublisher = bonusPublisher;
        this.settleGameRoundConsumer = settleGameRoundConsumer;

        this.chance = new Chance();  // Random number generator for auto-opening
    }

    /**
     * HANDLE CHEST OPENING - Main Bonus Game Interaction
     *
     * Process Flow:
     * 1. Validate chest selection (exists, not opened, within game rules)
     * 2. Mark chest as opened and publish prize to player
     * 3. Check if bonus game is complete (all required chests opened)
     * 4. Auto-settle the round if bonus game finished
     *
     * @param {Object} player - Player session data
     * @param {Object} payload - Contains chest index to open
     * @param {number} payload.chest - Index of chest to open (0-9)
     */
    async consume(player, payload) {
        const { chest } = payload;

        // Validate chest selection before processing
        if (!this.validate(player, chest)) {
            return;  // Validation failed, error already sent to player
        }

        const { bonusChests, finish } = this.gameData.ingame[player.profile.name];

        // Mark chest as opened
        bonusChests[chest].picked = true;

        // Publish prize reveal to player's client
        this.bonusPublisher.publishBonus(player.UID, {
            chest,
            amount: bonusChests[chest].amount
        });

        // Check if bonus game is complete
        const openedChests = bonusChests.filter((bonusChest) => bonusChest.picked).length;
        const requiredChests = finish.settlementResult.bonus.odds;

        if (openedChests === requiredChests) {
            // All required chests opened - complete the bonus game
            await this.settleGameRoundConsumer.autoSettleRound(player, finish.roundId);
        }
    }

    /**
     * AUTO-OPEN REMAINING CHESTS - Handle Abandoned Bonus Games
     *
     * When players abandon bonus games, automatically open remaining required chests.
     * This prevents games from being stuck and ensures fair settlement.
     *
     * Auto-Opening Logic:
     * - Calculate how many chests still need to be opened
     * - Randomly select required number from remaining chests
     * - Open them and publish prizes
     * - Complete the bonus game
     *
     * @param {Object} player - Player session data
     */
    async autoOpenRemainingChests(player) {
        const { finish } = this.gameData.ingame[player.profile.name] ?? {};
        const { bonusChests } = this.gameData.ingame[player.profile.name] ?? {};

        if (finish?.settlementResult) {
            // Find chests that haven't been opened yet
            const unpickedChests = bonusChests?.filter((chest) => !chest.picked) ?? [];

            if (unpickedChests.length === 0) {
                return;  // All chests already opened
            }

            // Calculate how many more chests need to be opened
            // bonus.odds = total chests that MUST be opened to complete game
            const totalRequired = finish.settlementResult.bonus.odds;
            const alreadyOpened = this.definition.bonusSize - unpickedChests.length;
            const remainingToOpen = totalRequired - alreadyOpened;

            // Randomly select which chests to auto-open
            const autoPickedChests = this.chance.pickset(unpickedChests, remainingToOpen);

            // Open selected chests and publish prizes
            autoPickedChests.forEach((chest) => {
                const chestIndex = bonusChests.indexOf(chest);

                chest.picked = true;
                this.bonusPublisher.publishBonus(player.UID, {
                    chest: chestIndex,
                    amount: chest.amount
                });
            });

            // Complete the bonus game
            await this.settleGameRoundConsumer.autoSettleRound(player, finish.roundId);
        }
    }

    /**
     * PROCESS EXPIRED BONUS GAMES - Cleanup System
     *
     * Background process that automatically completes abandoned bonus games.
     * Runs periodically to prevent stuck games and ensure fair settlements.
     *
     * Expiry Logic:
     * - Bonus games expire after bonusLiveSeconds (125 seconds)
     * - Finds all expired bonus games across all players
     * - Auto-opens remaining chests for each expired game
     */
    async processExpiredBonus() {
        // Calculate expiry threshold: current time - bonus live seconds
        const expiryTime = moment.utc().subtract(this.definition.bonusLiveSeconds, "seconds").toDate();

        // Find all players with expired bonus games
        const expiredBets = Object.values(this.gameData.ingame).filter(
            (currentBet) => Math.floor(currentBet.finish?.bonusTime / 1000) <= Math.floor(expiryTime / 1000)
        );

        // Auto-complete all expired bonus games
        await Promise.all(expiredBets.map((bet) => this.autoOpenRemainingChests(bet.player)));
    }

    /**
     * VALIDATE CHEST SELECTION - Prevent Invalid Interactions
     *
     * Comprehensive validation to ensure fair and secure bonus game play.
     * Checks for common cheating attempts and system integrity.
     *
     * Validation Rules:
     * 1. Chest must exist in player's bonus game
     * 2. Cannot open more chests than required for game completion
     * 3. Chest index must be valid number within bounds
     * 4. Cannot open already opened chests
     *
     * @param {Object} player - Player session data
     * @param {number} chest - Index of chest to validate (0-9)
     * @returns {boolean} - True if valid, false if invalid (error sent to player)
     */
    validate(player, chest) {
        const { bonusChests, finish } = this.gameData.ingame[player.profile.name] ?? { bonusChests: [], finish: {} };
        const totalPicked = (bonusChests?.filter((chest) => chest.picked)?.length ?? 0) + 1;

        const validationCriteria = [
            {
                // Chest must exist in player's current bonus game
                failure: bonusChests?.length === 0 || !bonusChests[chest],
                errorCode: SlotNoticeHelper.invalidBonus,
            },
            {
                // Cannot open more chests than required to complete the game
                failure: finish?.settlementResult?.bonus && totalPicked > finish.settlementResult.bonus.odds,
                errorCode: SlotNoticeHelper.invalidBonus,
            },
            {
                // Chest index must be valid number within game bounds
                failure: typeof chest !== "number" || chest < 0 || chest >= this.definition.bonusSize,
                errorCode: SlotNoticeHelper.invalidBonus,
            },
            {
                // Cannot open chests that are already opened
                failure: bonusChests && bonusChests[chest]?.picked,
                errorCode: SlotNoticeHelper.openedBonus,
            },
        ];

        // Find first validation failure
        const failedCriterion = validationCriteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            // Send error notification to player
            this.bonusPublisher.publishToUser(player.UID, {
                endBet: -1,
                notice: { errorCode: failedCriterion.errorCode }
            });

            return false;
        }

        return true;  // All validations passed
    }
}
