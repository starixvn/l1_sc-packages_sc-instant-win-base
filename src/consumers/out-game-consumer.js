import { gameNotifications } from "sc-base-database";
import { Core } from "sc-game-base";

import BonusConsumer from "./bonus-consumer";
import FreeSpinsConsumer from "./free-spins-consumer";

export default class OutGameConsumer extends Core.BaseEventConsumers.UserDisconnectConsumer {
    constructor(definition, gameData, bonusConsumer, freeSpinConsumer) {
        super(gameData);
        this.definition = definition;
        this.bonusConsumer = bonusConsumer ?? new BonusConsumer(definition, gameData);
        this.freeSpinConsumer = freeSpinConsumer ?? new FreeSpinsConsumer(definition, gameData);
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient) {
        const realPlayer = this.gameData.realPlayers[socketClient.id];

        await this.bonusConsumer.autoOpenRemainingChests(realPlayer);
        await this.updateFreeSpinNotification(realPlayer);

        super.consume(socketClient);
    }

    async updateFreeSpinNotification(realPlayer) {
        if (this.freeSpinConsumer.hasFreeSpin(realPlayer)) {
            const freeSpin = this.freeSpinConsumer.getFreeSpin(realPlayer);

            const gameInfo = {
                uid: realPlayer.UID,
                gameId: this.definition.id,
                gameInfo: { freeSpinExpiryTime: freeSpin.expiryTime },
            };

            await gameNotifications
                .updateOne(
                    { uid: realPlayer.UID, gameId: this.definition.id },
                    { $setOnInsert: gameInfo },
                    { upsert: true, setDefaultsOnInsert: true }
                )
                .exec();
        }
    }
}
