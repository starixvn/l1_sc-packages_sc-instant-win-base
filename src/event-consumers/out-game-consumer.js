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
        await this.upsertFreeSpinNotification(realPlayer);

        super.consume(socketClient);
    }

    async upsertFreeSpinNotification(realPlayer) {
        const latestExpiredFreeSpinSet = this.freeSpinConsumer.getLatestExpiredFreeSpinSet(realPlayer);
        const filter = {
            uid: realPlayer.UID,
            gameId: this.definition.id,
        };

        if (latestExpiredFreeSpinSet) {
            const adjustment = {
                gameInfo: {
                    freeSpinExpiryTime: latestExpiredFreeSpinSet.expiryTime,
                },
            };

            await gameNotifications.update(filter, { $set: adjustment }, { upsert: true });
        } else {
            await gameNotifications.deleteOne(filter);
        }
    }
}
