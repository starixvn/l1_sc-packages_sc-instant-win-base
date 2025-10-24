import math from "lodash/math";
import { helpers } from "sc-common";
import { Core } from "sc-game-base";
import { FreeSpinsConsumer, SettleGameRoundConsumer, ProgressBonusConsumer } from "./../event-consumers";
import SlotNoticeHelper from "./../helpers/slot-notice-helper";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

/**
 * SLOT PROCESS BET QUEUE - Bet Processing Engine
 *
 * PURPOSE:
 * Processes the queued bets from players, handles free spins, calculates contributions,
 * and initiates the game round settlement process.
 *
 * BET PROCESSING FLOW:
 * 1. **Validation**: Check if player can place bet (not in middle of round)
 * 2. **Free Spin Handling**: Use expired free spins or validate free spin requests
 * 3. **Bet Information**: Generate complete bet data with contributions and amounts
 * 4. **Round Creation**: Generate new round ID and create bet record
 * 5. **Settlement**: Trigger the complete game round processing
 *
 * KEY RESPONSIBILITIES:
 * - Queue management for asynchronous bet processing
 * - Free spin lifecycle management
 * - Jackpot contribution calculations
 * - Multi-currency bet handling
 * - Round ID generation and tracking
 */
export default class SlotProcessBetQueue extends Core.Crons.ProcessBetQueue {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {Core.BaseEventPublishers.PlaceBetPublisher} placeBetPublisher
     * @param {FreeSpinsConsumer} freeSpinsConsumer
     * @param {SettleGameRoundConsumer} settleGameRoundConsumer
     * @param {ProgressBonusConsumer} progressBonusConsumer
     * @param {placeBetApi} dependencies.placeBet
     * @param {logger} dependencies.logService
     * @param {mongoose.Model} dependencies.roundsRepository
     * @param {mongoose.Model} dependencies.betsRepository
     * @param {mongoose.Model} dependencies.betLogsRepository
     * @param {EventConsumers.IdCountersConsumer} dependencies.idCountersConsumer
     * @param {GameManagementApiClientFactory} dependencies.gameManagementApiClientFactory
     */
    constructor({
        definition,
        gameData,
        placeBetPublisher,
        freeSpinsConsumer,
        settleGameRoundConsumer,
        progressBonusConsumer,
        placeBet,
        logService,
        roundsRepository,
        betsRepository,
        betLogsRepository,
        idCountersConsumer,
        baseMetrics,
        jackpotValidator,
        gameManagementApiClientFactory,
    }) {
        super({
            definition,
            gameData,
            placeBetPublisher,
            placeBet,
            logService,
            betsRepository,
            betLogsRepository,
            gameManagementApiClientFactory,
            baseMetrics,
        });

        this.freeSpinsConsumer = freeSpinsConsumer;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.progressBonusConsumer = progressBonusConsumer;
        this.roundsRepository = roundsRepository;
        this.idCountersConsumer = idCountersConsumer;
        this.jackpotValidator = jackpotValidator;
    }

    /**
     * MAIN BET PROCESSING ENTRY POINT
     *
     * Processes a single bet from the queue, handling validation, free spins,
     * bet information generation, and round creation.
     *
     * Processing Steps:
     * 1. **Round State Check**: Ensure player isn't already in a round
     * 2. **Free Spin Logic**: Auto-use expired free spins or validate manual free spin requests
     * 3. **Bet Generation**: Create complete bet information with contributions
     * 4. **Round ID**: Generate unique round identifier
     * 5. **Parent Processing**: Call base class for API communication and balance updates
     *
     * @param {Object} player - Player session data
     * @param {Object} payload - Bet request payload
     */
    async proceedBet(player, payload) {
        // VALIDATION: Prevent bets if player already has an active round
        if (this.gameData.ingame[player.profile.name]?.finish) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, {
                endBet: -1,
                notice: { errorCode: helpers.noticeHelper.cannotPlaceBet }
            });
            return;
        }

        // FREE SPIN HANDLING: Check for expired free spins to auto-use
        const soonestExpiredFreeSpinSet = this.freeSpinsConsumer.getSoonestExpiredFreeSpinSet(player);

        // Set free spin flag: manual request OR auto-use expired spins
        payload.freeSpin = payload.freeSpin || (soonestExpiredFreeSpinSet == null ? false : true);

        // VALIDATION: Ensure free spin request is valid
        if (payload.freeSpin && !soonestExpiredFreeSpinSet) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, {
                endBet: -1,
                notice: { errorCode: SlotNoticeHelper.invalidFreeSpin }
            });
            return;
        }

        // Generate complete bet information with contributions and amounts
        const betInfo = await this.generateBetInfo(payload, soonestExpiredFreeSpinSet, player);

        // Generate new unique round ID for this bet
        await this.idCountersConsumer.consume("round");
        this.gameData.roundId++;

        // Call parent class for balance checking, API calls, and success handling
        await super.proceedBet(player, betInfo);
    }

    async generateBetInfo(payload, freeSpinInfo, player) {
        const betInfo = { ...payload };
        const { slotsConfig } = this.gameData.gameConfigs;

        if (freeSpinInfo) {
            const { bet, paylines } = freeSpinInfo;

            betInfo.betChoice = paylines;
            betInfo.amount = bet;
        }

        betInfo.totalAmount = math.round(betInfo.amount * betInfo.betChoice.length, 2);

        betInfo.contributionRate = this.getContributionRate(slotsConfig, player, payload);
        betInfo.contributionAmount = math.round(betInfo.contributionRate * betInfo.totalAmount, 4);

        return betInfo;
    }

    getContributionRate(slotsConfig, player, payload) {
        const { pools } = slotsConfig.jackpot;
        let totalContributionRate = 0;

        if (this.jackpotValidator.canContributeJackpotPools(player, payload.freeSpin)) {
            Object.values(pools).forEach((pool) => {
                totalContributionRate += pool.playerSettings.contrib;
            });
            return totalContributionRate;
        }

        return 0;
    }

    formatApiBetInfo(payload) {
        return {
            amount: payload.totalAmount,
            gameId: this.definition.id,
            gameRoundId: this.gameData.roundId,
            choiceId: 0,
            freeBet: payload.freeBet,
            freeSpin: payload.freeSpin,
            contributionRate: payload.contributionRate,
            contributionAmount: payload.contributionAmount,
        };
    }

    composeBettingTimeValidationCriteria(roundId) {
        return [];
    }

    async handleSuccessBet(player, balance, roundId, bet) {
        if (bet.freeSpin) {
            await this.freeSpinsConsumer.useFreeSpin(player);
        }

        const rate = this.calculateCurrencyRate(player.session);

        await this.upsertBet(player, roundId, bet, rate);
        this.notifyPlacingBetResult(player, balance, bet, rate);

        await this.progressBonusConsumer.trackBetAndCheckProgressBonus(player, bet.totalAmount, roundId, bet.freeSpin);

        await this.settleGameRoundConsumer.settleRound(player, roundId);
    }

    async upsertBet(player, roundId, bet, rate) {
        const newBet = {
            id: roundId,
            uid: player.UID,
            name: player.profile.name,
            freeBet: bet.freeBet,
            time: new Date(),
            paylines: bet.betChoice,
            freeSpin: bet.freeSpin,
            bet: bet.amount,
            totalAmount: bet.totalAmount,
            baseTotalAmount: math.round(bet.totalAmount * rate, 2),
            rate: rate,
            exchangeRateId: this.gameData.exchangeRates.exId,
        };

        if (this.jackpotValidator.canAccessJackpot(player)) {
            newBet.jackpotContribution = {
                contributionRate: bet.contributionRate,
                baseContributionAmount: math.round(bet.totalAmount * bet.contributionRate * rate, 4),
            };
        }

        if (player.session) {
            newBet.siteId = player.session.siteId;
            newBet.currency = player.session.currencyName;

            newBet.operatorId = player.session.operatorId;
            newBet.playerId = player.session.playerId;
        }

        await this.roundsRepository.create(newBet);
    }

    generatePlacingBetResult(player, balance, bet) {
        const { totalAmount, freeSpin } = bet;

        return {
            endBet: totalAmount,
            freeSpin,
            user: { ...balance },
        };
    }

    decreaseBetTracks(playerName, bet) {}
}
