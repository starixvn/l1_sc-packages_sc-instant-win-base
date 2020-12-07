import { Core } from "sc-game-base";

import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class SlotProcessBetQueue extends Core.Cron.ProcessBetQueue {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     */
    constructor(definition, gameData, publisher = null) {
        super(definition, gameData, publisher);
    }

    async proceedBet(player, payload) {
        if (payload.freeSpin) {
            if (!this.validateFreeSpin(player, payload)) {
                return;
            }

            const { prevBet } = this.gameData.ingame[player.profile.name];
            payload.amount = payload.freeSpin ? prevBet.amount : payload.amount;
            payload.totalAmount = (payload.freeSpin ? prevBet.amount : payload.amount) * payload.betChoice.length;
            payload.betChoice = prevBet.betChoice;
        }

        await super.processBet(player, payload);
    }

    validateFreeSpin(player, payload) {
        if (this.gameData.ingame[player.profile.name]?.freeSpins) {
            const freeSpins = this.gameData.ingame[player.profile.name]?.freeSpins;

            return freeSpins.filter((spin) => spin.expiration > Date.now()).reduce((total, freeSpin) => (total += freeSpin.count), 0) > 0;
        }

        return false;
    }

    async handleSuccessBet(player, balance, roundId, bet) {
        await super.handleSuccessBet(player, balance, roundId, bet);

        if (bet.freeSpin) {
            await this.updateFreeSpins(player);
        }
    }

    async updateFreeSpins(player) {
        const freeSpin = this.gameData.ingame[player.profile.name].freeSpins[0];

        if (freeSpin.count > 1) {
            freeSpin.count--;
        } else {
            this.gameData.ingame[player.profile.name].freeSpins.shift();
        }

        await this.definition.freeSpinRepository.updateOne(
            { uid: player.UID, time: freeSpin.time },
            { $inc: -1 },
            { upsert: true, setDefaultsOnInsert: true }
        );
    }

    async upsertBet(player, roundId, bet) {
        const existingBetFilter = { uid: player.UID, phien: roundId, freeBet: bet.freeBet };

        const newBet = {
            uid: player.UID,
            name: player.profile.name,
            phien: roundId,
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
