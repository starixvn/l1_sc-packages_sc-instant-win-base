import { Core } from "sc-game-base";

import BonusConsumer from "./bonus-consumer";

export default class OutGameConsumer extends Core.BaseEventConsumers.UserDisconnectConsumer {
    constructor(definition, gameData, bonusConsumer) {
        super(gameData);

        this.bonusConsumer = bonusConsumer ?? new BonusConsumer(definition, gameData);
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient) {
        const realPlayer = this.gameData.realPlayers[socketClient.id];
        await this.bonusConsumer.autoOpenRemaningChests(realPlayer);

        super.consume(socketClient);
    }
}
