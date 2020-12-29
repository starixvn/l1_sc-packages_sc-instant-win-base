import { logger } from "sc-common";
import { Core } from "sc-game-base";

import { FreeSpinsConsumer, SettleGameRoundConsumer } from "./../event-consumers";
import SlotNoticeHelper from "./../helpers/slot-notice-helper";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class SlotProcessBetQueue extends Core.Cron.ProcessBetQueue {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {Core.BaseEventPublishers.BasePublisher} publisher
     * @param {FreeSpinsConsumer} freeSpinsConsumer
     * @param {SettleGameRoundConsumer} settleRoundConsumer
     */
    constructor(definition, gameData, publisher = null, freeSpinsConsumer = null, settleRoundConsumer = null) {
        super(definition, gameData, publisher);

        this.freeSpinsConsumer = freeSpinsConsumer ?? new FreeSpinsConsumer(definition, gameData);
        this.settleRoundConsumer = settleRoundConsumer ?? new SettleGameRoundConsumer({ definition, gameData });
    }

    async proceedBet(player, payload) {
        const soonestExpiredFreeSpinSet = this.freeSpinsConsumer.getSoonestExpiredFreeSpinSet(player);

        payload.freeSpin = payload.freeSpin || (!payload.freeSpin && soonestExpiredFreeSpinSet);

        if (payload.freeSpin && !soonestExpiredFreeSpinSet) {
            this.publisher.publishGameFailedBet(player.UID, { endBet: -1, notice: SlotNoticeHelper.invalidFreeSpin });

            return;
        }

        if (soonestExpiredFreeSpinSet) {
            const { bet, paylines } = soonestExpiredFreeSpinSet;

            payload.betChoice = paylines;
            payload.amount = bet;
        }

        payload.totalAmount = payload.amount * payload.betChoice.length;
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
        };
    }

    async handleSuccessBet(player, balance, roundId, bet) {
        if (bet.freeSpin) {
            await this.freeSpinsConsumer.useFreeSpin(player);
        }

        await this.upsertBet(player, roundId, bet);
        this.notifyPlacingBetResult(player, balance, bet);

        await this.settleRoundConsumer.settleRound(player, roundId);
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

        logger.log(`upsertBet player ${newBet.name} - round ${newBet.id} - choices ${newBet.paylines?.length} - amount ${newBet.amount}`);
        await this.definition.roundRepository.create(newBet);
    }

    generatePlacingBetResult(player, balance, bet) {
        const { totalAmount, freeSpin } = bet;

        return {
            endBet: totalAmount,
            freeSpin,
            user: { ...balance },
        };
    }
}
