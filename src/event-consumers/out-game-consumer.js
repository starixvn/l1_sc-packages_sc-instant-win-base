import mongoose from "mongoose";
import { Core } from "sc-game-base";

import SlotGameData from "./../slot-game-data";
import BonusConsumer from "./bonus-consumer";
import FreeSpinsConsumer from "./free-spins-consumer";
import JackpotGameConsumer from "./jackpot-game-consumer";

export default class OutGameConsumer extends Core.BaseEventConsumers.UserDisconnectConsumer {
    /**
     * @param {Number} gameId
     * @param {SlotGameData} gameData
     * @param {UserTrackingClient} userTrackingClient
     * @param {BonusConsumer} bonusConsumer
     * @param {FreeSpinsConsumer} freeSpinsConsumer
     * @param {mongoose.Model} gameNotificationsRepository
     * @param {JackpotGameConsumer} jackpotGameConsumer
     */
    constructor(gameId, gameData, userTrackingClient, bonusConsumer, freeSpinsConsumer, gameNotificationsRepository, jackpotGameConsumer) {
        super(gameData, userTrackingClient);

        this.gameId = gameId;
        this.bonusConsumer = bonusConsumer;
        this.freeSpinsConsumer = freeSpinsConsumer;
        this.gameNotificationsRepository = gameNotificationsRepository;
        this.jackpotGameConsumer = jackpotGameConsumer;
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    async consume(socketClient) {
        const realPlayer = this.gameData.realPlayers[socketClient.id];

        if (realPlayer) {
            await this.jackpotGameConsumer.autoPickJackpot(realPlayer);
            await this.bonusConsumer.autoOpenRemainingChests(realPlayer);
            await this.upsertFreeSpinNotification(realPlayer);
            delete this.gameData.players[realPlayer.UID];
        }

        super.consume(socketClient);
    }

    async upsertFreeSpinNotification(realPlayer) {
        const latestExpiredFreeSpinSet = this.freeSpinsConsumer.getLatestExpiredFreeSpinSet(realPlayer);
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
