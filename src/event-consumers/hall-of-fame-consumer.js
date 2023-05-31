import mongoose from "mongoose";
import GameData from "sc-game-base/src/core/game-data";

export default class HallOfFameConsumer {
    /**
     * @param {mongoose.Model} famesRepository
     * @param {GameData} dependencies.gameData
     */
    constructor(famesRepository, gameData) {
        this.famesRepository = famesRepository;
        this.gameData = gameData;
    }

    async add(player, { roundId, bet, totalAmount, baseTotalAmount, winningAmount, baseWinningAmount, numberOfPaylines, freeSpin = false, rate }) {
        const fame = {
            uid: player.UID,
            name: player.profile.name,
            roundId,
            bet,
            totalAmount,
            baseTotalAmount,
            winningAmount,
            baseWinningAmount,
            numberOfPaylines,
            freeSpin,
            time: new Date(),
            exchangeRateId: this.gameData.exchangeRates.exId,
            rate
        };

        if (!!player.session) {
            fame.currency = player.session.currencyName;
            fame.operatorId = player.session.operatorId;
            fame.playerId = player.session.playerId;
        }

        await this.famesRepository.create(fame);
    }
}
