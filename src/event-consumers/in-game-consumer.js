import { getBalance } from "sc-base-apis";
import { Core } from "sc-game-base";

import { FreeSpinsConsumer } from ".";

export default class InGameConsumer extends Core.BaseEventConsumers.InGameConsumer {
    constructor({ definition, gameData, roundQuery, publisher, freeSpinConsumer }) {
        super({ definition, gameData, roundQuery, publisher });
        this.freeSpinConsumer = freeSpinConsumer ?? new FreeSpinsConsumer();
    }

    async buildPayload(realPlayer) {
        const { stakeLevels, icons: odds } = this.gameData.gameConfigs.slotsConfig;
        const gameConfigs = { stakeLevels: stakeLevels.map((level) => level.stake), odds };
        const totalOfFreeSpins = this.freeSpinConsumer.getTotalAvaiableFreeSpins(realPlayer);

        await getBalance(realPlayer, true);

        const user = await this.getUserInfo(realPlayer.UID);

        return {
            gameConfigs,
            totalOfFreeSpins,
            user,
        };
    }
}
