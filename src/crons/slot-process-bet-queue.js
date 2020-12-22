import { placeBet as placeBetApi } from "sc-base-apis";
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
        if (payload.freeSpin) {
            const soonestExpiredFreeSpinSet = this.freeSpinsConsumer.getSoonestExpiredFreeSpinSet(player);

            if (!soonestExpiredFreeSpinSet) {
                this.publisher.publishGameFailedBet(player.UID, { endBet: -1, notice: SlotNoticeHelper.invalidFreeSpin });

                return;
            }

            const { bet, paylines } = soonestExpiredFreeSpinSet;

            payload.betChoice = paylines;
            payload.amount = bet;
        }

        payload.totalAmount = payload.amount * payload.betChoice.length;
        this.gameData.roundId += 1;

        await this.sendToApi(player, payload);
    }

    async sendToApi(player, payload) {
        const betInfo = {
            amount: payload.totalAmount,
            gameId: this.definition.id,
            gameRoundId: this.gameData.roundId,
            choiceId: 0,
            freeBet: payload.freeBet,
            freeSpin: payload.freeSpin,
        };

        const apiResult = await placeBetApi({ id: player.UID, session: player.session }, betInfo);

        if (apiResult.isOk) {
            await this.handleSuccessBet(player, apiResult.response, betInfo.gameRoundId, payload);
        } else {
            const insufficientNotice = payload.freeBet ? helpers.noticeHelper.notEnoughScoin : helpers.noticeHelper.notEnoughMoney;
            const notice = apiResult.response.inSufficientBalance ? insufficientNotice : apiResult.response;

            this.handleFailedBet(player, notice);
        }
    }

    async handleSuccessBet(player, balance, roundId, bet) {
        await super.handleSuccessBet(player, balance, roundId, bet);

        if (bet.freeSpin) {
            await this.freeSpinsConsumer.useFreeSpin(player);
        }

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

        await this.definition.roundRepository.create(newBet);
    }

    adjustBetTracks(playerName, bet) {}

    adjustTotalBets(player, bet) {}

    generatePlacingBetResult(player, balance, bet) {
        const { totalAmount, freeSpin } = bet;

        return {
            endBet: totalAmount,
            freeSpin,
            user: { ...balance },
        };
    }
}
