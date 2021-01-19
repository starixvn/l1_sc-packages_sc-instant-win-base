import mongoose from "mongoose";
import { Core } from "sc-game-base";

import SlotGameData from "./../slot-game-data";
import BonusConsumer from "./bonus-consumer";
import FreeSpinsConsumer from "./free-spins-consumer";

export default class OutGameConsumer extends Core.BaseEventConsumers.UserDisconnectConsumer {
    /**
     * @param {Number} gameId
     * @param {SlotGameData} gameData
     * @param {BonusConsumer} gameData
     * @param {FreeSpinsConsumer} gameData
     * @param {mongoose.Model} gameNotificationsRepository
     */
    constructor(gameId, gameData, bonusConsumer, freeSpinConsumer, gameNotificationsRepository) {
        super(gameData);

        this.gameId = gameId;
        this.bonusConsumer = bonusConsumer;
        this.freeSpinConsumer = freeSpinConsumer;
        this.gameNotificationsRepository = gameNotificationsRepository;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient) {
        const realPlayer = this.gameData.realPlayers[socketClient.id];

        if (realPlayer) {
            await this.bonusConsumer.autoOpenRemainingChests(realPlayer);
            await this.upsertFreeSpinNotification(realPlayer);
        }

        super.consume(socketClient);
    }

    async upsertFreeSpinNotification(realPlayer) {
        const latestExpiredFreeSpinSet = this.freeSpinConsumer.getLatestExpiredFreeSpinSet(realPlayer);
        const filter = {
            uid: realPlayer.UID,
            gameId: this.gameId,
        };

        if (latestExpiredFreeSpinSet) {
            const adjustment = {
                gameInfo: {
                    freeSpinExpiryTime: latestExpiredFreeSpinSet.expiryTime,
                },
            };

            await this.gameNotificationsRepository.updateOne(filter, { $set: adjustment }, { upsert: true });
        } else {
            await this.gameNotificationsRepository.deleteOne(filter);
        }
    }
}
