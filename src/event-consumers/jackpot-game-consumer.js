import Chance from "chance";
import moment from "moment";

import { JackpotPublisher } from "./../event-publishers";
import SlotNoticeHelper from "./../helpers/slot-notice-helper";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
import SettleGameRoundConsumer from "./settle-game-round-consumer";

/**
 * JACKPOT GAME CONSUMER - Prize Wheel Interaction Manager
 *
 * PURPOSE:
 * Manages the interactive jackpot prize wheel where players select their prize tier.
 * Handles prize selection, validation, auto-selection for expired games, and final settlement.
 *
 * JACKPOT WIN PROCESS:
 * 1. Player gets 5 jackpot symbols → GenerateResultConsumer creates prize wheel
 * 2. Client displays spinning wheel with 10 prize options (Grand/Major/Minor)
 * 3. Player clicks to stop wheel and select prize → JackpotGameConsumer processes
 * 4. Selected prize tier determines which progressive pool is won
 * 5. Final settlement completes with actual jackpot amount
 *
 * TIMEOUT HANDLING:
 * - Jackpot games expire after jackpotLiveSeconds (65 seconds)
 * - Auto-selects random prize for abandoned games
 * - Prevents games from being stuck in jackpot state
 *
 * VALIDATION:
 * - Ensures chest index is valid (0-9)
 * - Prevents double-selection of already chosen prizes
 * - Validates player has active jackpot game
 */
export default class JackpotGameConsumer {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {JackpotPublisher} jackpotPublisher
     * @param {SettleGameRoundConsumer} settleGameRoundConsumer
     * @param {mongoose.Model} dependencies.roundsRepository
     */
    constructor({ definition, gameData, jackpotPublisher, settleGameRoundConsumer, roundsRepository, logService }) {
        this.definition = definition;
        this.gameData = gameData;
        this.jackpotPublisher = jackpotPublisher;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.roundsRepository = roundsRepository;
        this.logService = logService;

        this.chance = new Chance();
    }

    /**
     * HANDLE PRIZE SELECTION - Main Jackpot Interaction
     *
     * Processes a player's prize selection from the jackpot wheel.
     * Updates the bet record and triggers final jackpot settlement.
     *
     * Process Flow:
     * 1. **Validate Selection**: Ensure chest index is valid and game isn't expired
     * 2. **Update Bet Record**: Mark prize as selected in database
     * 3. **Trigger Settlement**: Complete jackpot win with final amount
     *
     * Selection Method: Player provides chest index (0-9) from the prize wheel.
     * If no chest provided, random selection is used for auto-pick.
     *
     * @param {Object} player - Player session data
     * @param {Object} payload - Contains chest index to select
     * @param {number} payload.chest - Prize wheel position (0-9)
     */
    async consume(player, payload) {
        const { chest } = payload;

        // Validate the prize selection
        if (!this.validate(player, chest)) {
            return;  // Validation failed, error sent to player
        }

        // Update bet record with selected prize and get updated bet
        const { bet } = await this.pickJackpotAndUpdateBet({ player, chest });

        if (!bet) {
            this.publishInvalidJackpotToUser(player);
            return;
        }

        // Complete jackpot settlement with the selected prize tier
        await this.settleGameRoundConsumer.settleWithJackpotWin({ player, roundId: bet.id });
    }

    /**
     * SELECT PRIZE AND UPDATE BET - Core Selection Logic
     *
     * Records the player's prize selection and updates the bet record in the database.
     * This is where the prize tier is permanently associated with the bet.
     *
     * Selection Process:
     * 1. **Get Current Jackpot**: Retrieve player's active jackpot game state
     * 2. **Determine Selection**: Use provided chest or pick random for auto-select
     * 3. **Update Database**: Mark prize as selected and record winning tier
     * 4. **Mark as Picked**: Update in-memory state to prevent double selection
     *
     * Database Update: Uses MongoDB atomic operation to ensure consistency
     * Filters by player/operator to ensure security and prevent conflicts.
     *
     * @param {Object} params - Selection parameters
     * @param {Object} params.player - Player session data
     * @param {number} params.chest - Prize wheel position (optional for auto-pick)
     * @returns {Object} - Updated bet and selected prize
     */
    async pickJackpotAndUpdateBet({ player, chest }) {
        const jackpot = this.getJackpot(player);

        if (jackpot && jackpot.prizes?.length > 0) {
            // Auto-select random prize if no chest specified (for expired games)
            if (!chest) {
                chest = this.chance.integer({ min: 0, max: jackpot.prizes.length - 1 });
            }

            // Atomically update bet record with selected prize
            const bet = await this.roundsRepository.findOneAndUpdate(
                {
                    playerId: player.session.playerId,           // Security: match player
                    operatorId: player.session.operatorId,       // Security: match operator
                    paid: false,                                // Only unpaid bets
                    "settlementResult.jackpot.picked": false,   // Prevent double selection
                },
                {
                    $set: {
                        "settlementResult.jackpot.picked": true,           // Mark as selected
                        "settlementResult.jackpot.winningPrize": jackpot.prizes[chest]  // Record prize tier
                    }
                },
                {
                    new: true,    // Return updated document
                    lean: true,   // Fast query
                }
            );

            if (bet) {
                jackpot.picked = true;  // Update in-memory state

                return { bet, winningPrize: jackpot.prizes[chest] };
            }
        }

        return { bet: null, winningPrize: null };  // No valid jackpot found
    }

    /**
     * PROCESS EXPIRED JACKPOT GAMES - Cleanup Abandoned Games
     *
     * Background process that automatically completes abandoned jackpot games.
     * Prevents games from being stuck in jackpot state indefinitely.
     *
     * Expiry Logic:
     * - Jackpot games expire after jackpotLiveSeconds (65 seconds)
     * - Finds all active jackpot games past expiry time
     * - Auto-selects random prize for each expired game
     * - Completes settlement to release player and funds
     *
     * Why Important: Prevents stuck games, ensures fair play, maintains game flow
     */
    async processExpired() {
        // Calculate expiry threshold: current time - jackpot live seconds
        const expiryTime = moment.utc().subtract(this.definition.jackpotLiveSeconds, "seconds").toDate();

        try {
            // Find all expired jackpot games
            const runningBets = Object.values(this.gameData.ingame).filter(
                (currentBet) =>
                    currentBet.finish &&  // Has active game state
                    Math.floor(currentBet.finish?.time / 1000) <= Math.floor(expiryTime / 1000) &&  // Past expiry
                    this.isHavingJackpot(currentBet)  // Has unclaimed jackpot
            );

            // Auto-complete all expired games
            await Promise.all(runningBets.map((ingameBet) => this.autoPickJackpot(ingameBet.player)));
        } catch (error) {
            this.logService.logError(error);
        }
    }

    async autoPickJackpot(player) {
        const { bet } = await this.pickJackpotAndUpdateBet({ player });

        if (!bet) {
            return;
        }

        await this.settleGameRoundConsumer.settleWithJackpotWin({ player, roundId: bet.id });
    }

    isHavingJackpot(bet) {
        if (bet.finish?.settlementResult) {
            const { jackpot } = bet.finish.settlementResult;

            return jackpot ? jackpot.winningLine >= 0 && !jackpot.picked : false;
        }

        return false;
    }

    validate(player, chest) {
        const jackpot = this.getJackpot(player);

        if (this.isInvalidChest(chest, jackpot.prizes)) {
            this.publishInvalidJackpotToUser(player);
            return false;
        }

        if (jackpot.picked) {
            this.publishOpenedJackpotToUser(player);
            return false;
        }

        return true;
    }

    getJackpot(player) {
        const { finish } = this.gameData.ingame[player.profile.name] ?? {};
        const { jackpot } = finish?.settlementResult ?? { jackpot: { picked: true, prizes: [] } };

        return jackpot;
    }

    isInvalidChest(chest, prizes) {
        return typeof chest !== "number" || chest < 0 || chest >= prizes.length;
    }
    publishOpenedJackpotToUser(player) {
        this.jackpotPublisher.publishToUser(player.UID, { endBet: -1, notice: { errorCode: SlotNoticeHelper.openedJackpot } });
    }

    publishInvalidJackpotToUser(player) {
        this.jackpotPublisher.publishToUser(player.UID, { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidJackpot } });
    }
}
