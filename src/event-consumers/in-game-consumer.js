import { getBalance } from "sc-base-apis";
import { Core } from "sc-game-base";

import { Jackpots } from "./../models";
import FreeSpinsConsumer from "./free-spins-consumer";

export default class InGameConsumer extends Core.BaseEventConsumers.InGameConsumer {
    constructor({ definition, gameData, roundQuery, publisher, freeSpinsConsumer }) {
        super({ definition, gameData, roundQuery, publisher });

        this.freeSpinsConsumer = freeSpinsConsumer ?? new FreeSpinsConsumer(definition, gameData);
    }

    async buildPayload(realPlayer) {
        const { stakeLevels, icons: odds } = this.gameData.gameConfigs.slotsConfig;
        const gameConfigs = {
            stakeLevels: stakeLevels.map((level) => level.stake),
            odds,
        };
        const totalOfFreeSpins = this.freeSpinsConsumer.getTotalAvaiableFreeSpins(realPlayer);
        const soonestExpiredFreeSpinSet = this.freeSpinsConsumer.getSoonestExpiredFreeSpinSet(realPlayer);
        const freeSpins = {
            total: totalOfFreeSpins,
            bet: soonestExpiredFreeSpinSet.bet,
            paylines: soonestExpiredFreeSpinSet.paylines,
        };
        const jackpotPools = await this.getPools();

        await getBalance(realPlayer, true);

        const user = await this.getUserInfo(realPlayer.UID);

        return {
            gameConfigs,
            jackpotPools,
            freeSpins,
            user,
        };
    }

    async getPools() {
        const runningPoolsFilter = {
            gameId: this.definition.id,
            winnerName: { $exists: false },
        };
        const projection = {
            _id: false,
            pool: true,
            amount: true,
        };

        return await Jackpots.find(runningPoolsFilter, projection).lean().exec();
    }
}
