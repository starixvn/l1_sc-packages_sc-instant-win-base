import { Core } from "sc-game-base";

import FreeSpinsConsumer from "../consumers/free-spins-consumer";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class SlotProcessBetQueue extends Core.Cron.ProcessBetQueue {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     */
    constructor(definition, gameData, publisher = null, freeSpinsConsumer = null) {
        super(definition, gameData, publisher);
        this.freeSpinsConsumer = freeSpinsConsumer ?? new FreeSpinsConsumer(definition, gameData);
    }

    async proceedBet(player, payload) {
        if (payload.freeSpin) {
            if (!this.freeSpinsConsumer.hasFreeSpin(player)) {
                return;
            }

            const betAmount = this.freeSpinsConsumer.getFreeSpinBet(player);
            payload.amount = payload.freeSpin ? prevBet.amount : payload.amount;
            payload.totalAmount = (payload.freeSpin ? prevBet.amount : payload.amount) * payload.betChoice.length;
            payload.betChoice = prevBet.betChoice;
        }

        await super.processBet(player, payload);
    }

    async handleSuccessBet(player, balance, roundId, bet) {
        await super.handleSuccessBet(player, balance, roundId, bet);

        if (bet.freeSpin) {
            await this.freeSpinsConsumer.useFreeSpin(player);
        }

        this.gameData.roundId += 1;
    }

    async upsertBet(player, roundId, bet) {
        const existingBetFilter = { uid: player.UID, roundId: roundId, freeBet: bet.freeBet };

        const newBet = {
            uid: player.UID,
            name: player.profile.name,
            roundId: roundId,
            time: new Date(),
            freeBet: bet.freeBet,
            paylines: bet.betChoice,
            freeSpin: bet.freeSpin,
            bet: bet.amount,
            totalAmount: bet.totalAmount,
        };

        if (player.session) {
            newBet.memberId = player.session.memberId;
            newBet.siteId = player.session.siteId;
        }

        await this.definition.betRepository.updateOne(existingBetFilter, { $setOnInsert: newBet }, { upsert: true, setDefaultsOnInsert: true });
    }
}
