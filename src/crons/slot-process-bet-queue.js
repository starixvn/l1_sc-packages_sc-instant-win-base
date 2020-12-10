import { Core } from "sc-game-base";

import SettleGameRoundConsumer from "../consumers/settle-game-round-consumer";
import FreeSpinsConsumer from "./../consumers/free-spins-consumer";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class SlotProcessBetQueue extends Core.Cron.ProcessBetQueue {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     */
    constructor(definition, gameData, publisher = null, freeSpinsConsumer = null, settleRoundConsumer = null) {
        super(definition, gameData, publisher);
        this.freeSpinsConsumer = freeSpinsConsumer ?? new FreeSpinsConsumer(definition, gameData);
        this.settleRoundConsumer = settleRoundConsumer ?? new SettleGameRoundConsumer(definition, gameData);
    }

    async proceedBet(player, payload) {
        if (payload.freeSpin) {
            if (!this.freeSpinsConsumer.hasFreeSpin(player)) {
                return;
            }

            const { bet, paylines } = this.freeSpinsConsumer.getFreeSpin(player);

            payload.betChoice = paylines;
            payload.amount = bet;
        }

        payload.totalAmount = payload.amount * payload.betChoice.length;
        this.gameData.roundId += 1;

        return super.proceedBet(player, payload);
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
}
