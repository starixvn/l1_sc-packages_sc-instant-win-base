import { helpers, logger } from "sc-common";
import { Core } from "sc-game-base";

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
    }) {
        super({
            definition,
            gameData,
            placeBetPublisher,
            placeBet,
            logService,
            betsRepository,
            betLogsRepository,
        });

        this.freeSpinsConsumer = freeSpinsConsumer;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.roundsRepository = roundsRepository;
    }

    async proceedBet(player, payload) {
        if (this.gameData.ingame[player.profile.name]?.finish) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, notice: helpers.noticeHelper.cannotPlaceBet });

            return;
        }

        const soonestExpiredFreeSpinSet = this.freeSpinsConsumer.getSoonestExpiredFreeSpinSet(player);
        const { slotsConfig } = this.gameData.gameConfigs;
        const contributionRate = slotsConfig.jackpot ? slotsConfig.jackpot.playerContributionRatio : 0;

        payload.freeSpin = payload.freeSpin || (soonestExpiredFreeSpinSet == null ? false : true);

        if (payload.freeSpin && !soonestExpiredFreeSpinSet) {
            this.placeBetPublisher.publishGameFailedBet(player.UID, { endBet: -1, notice: SlotNoticeHelper.invalidFreeSpin });

            return;
        }

        if (soonestExpiredFreeSpinSet) {
            const { bet, paylines } = soonestExpiredFreeSpinSet;

            payload.betChoice = paylines;
            payload.amount = bet;
        }

        payload.totalAmount = parseFloat((payload.amount * payload.betChoice.length).toFixed(2));
        payload.contributionRate = parseFloat(contributionRate.toFixed(4));
        payload.contributionAmount = parseFloat((contributionRate * payload.totalAmount).toFixed(4));

        this.gameData.roundId += 1;

        await super.proceedBet(player, payload);
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

    async handleSuccessBet(player, balance, roundId, bet) {
        if (bet.freeSpin) {
            await this.freeSpinsConsumer.useFreeSpin(player);
        }

        await this.upsertBet(player, roundId, bet);
        this.notifyPlacingBetResult(player, balance, bet);

        await this.settleGameRoundConsumer.settleRound(player, roundId);
    }

    async upsertBet(player, roundId, bet) {
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
        };

        if (player.session) {
            newBet.memberId = player.session.memberId;
            newBet.siteId = player.session.siteId;
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
