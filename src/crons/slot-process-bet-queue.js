import math from "lodash/math";
import { helpers } from "sc-common";
import { Core } from "sc-game-base";
import { tracer } from "sc-instrument";
import { FreeSpinsConsumer, SettleGameRoundConsumer } from "./../event-consumers";
import SlotNoticeHelper from "./../helpers/slot-notice-helper";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class SlotProcessBetQueue extends Core.Crons.ProcessBetQueue {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {Core.BaseEventPublishers.PlaceBetPublisher} placeBetPublisher
     * @param {FreeSpinsConsumer} freeSpinsConsumer
     * @param {SettleGameRoundConsumer} settleGameRoundConsumer
     * @param {placeBetApi} dependencies.placeBet
     * @param {logger} dependencies.logService
     * @param {mongoose.Model} dependencies.roundsRepository
     * @param {mongoose.Model} dependencies.betsRepository
     * @param {mongoose.Model} dependencies.betLogsRepository
     * @param {mongoose.Model} dependencies.userInfosRepository
     * @param {EventConsumers.IdCountersConsumer} dependencies.idCountersConsumer
     */
    constructor({
        definition,
        gameData,
        placeBetPublisher,
        freeSpinsConsumer,
        settleGameRoundConsumer,
        placeBet,
        logService,
        roundsRepository,
        betsRepository,
        betLogsRepository,
        userInfosRepository,
        idCountersConsumer,
        baseMetrics,
        jackpotValidator,
    }) {
        super({
            definition,
            gameData,
            placeBetPublisher,
            placeBet,
            logService,
            betsRepository,
            betLogsRepository,
            userInfosRepository,
            baseMetrics,
        });

        this.freeSpinsConsumer = freeSpinsConsumer;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.roundsRepository = roundsRepository;
        this.idCountersConsumer = idCountersConsumer;
        this.jackpotValidator = jackpotValidator;
    }

    dequeueBets() {
        if (this.gameData.ingame) {
            Object.values(this.gameData.ingame).forEach((playerInGame) => {
                if (!playerInGame.betProcessing && playerInGame.betQueue && playerInGame.betQueue.length > 0) {
                    const self = this;
                    const { player, payload } = playerInGame.betQueue.shift();

                    playerInGame.betProcessing = true;

                    tracer.startActiveSpan("dequeueBet", async (span) => {
                        self.proceedBet(player, payload)
                            .then(() => (playerInGame.betProcessing = false))
                            .catch(self.logService.logError)
                            .finally(() => span.end());
                    });
                }
            });
        }
    }

    async proceedBet(player, payload) {
        if (this.gameData.ingame[player.profile.name]?.finish) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, notice: { errorCode: helpers.noticeHelper.cannotPlaceBet } });

            return;
        }

        const soonestExpiredFreeSpinSet = this.freeSpinsConsumer.getSoonestExpiredFreeSpinSet(player);

        payload.freeSpin = payload.freeSpin || (soonestExpiredFreeSpinSet == null ? false : true);

        if (payload.freeSpin && !soonestExpiredFreeSpinSet) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidFreeSpin } });

            return;
        }

        const betInfo = await this.generateBetInfo(payload, soonestExpiredFreeSpinSet, player);

        await this.idCountersConsumer.consume("round");
        this.gameData.roundId++;

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

        const contributionRate = this.jackpotValidator.canContributeJackpotPools(player, payload.freeSpin)
            ? slotsConfig.jackpot.playerContributionRatio
            : 0;
        betInfo.contributionRate = contributionRate;
        betInfo.contributionAmount = math.round(contributionRate * betInfo.totalAmount, 4);

        return betInfo;
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
