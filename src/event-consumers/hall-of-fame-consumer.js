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

    async add(player, { roundId, bet, totalAmount, winningAmount, numberOfPaylines, freeSpin = false, rate = 0 }) {
        const fame = {
            uid: player.UID,
            name: player.profile.name,
            roundId,
            bet,
            totalAmount,
            winningAmount,
            numberOfPaylines,
            freeSpin,
            time: new Date(),
            exchangeRateId: this.gameData.exchangeRates.exId,
        };

        if (!!player.session) {
            fame.memberId = player.session.memberId;
            fame.partnerId = player.session.partnerId;
            fame.currency = player.session.currencyName;
            fame.rate = rate || this.calculateRate(player.session, this.gameData);
            fame.operatorId = player.session.partnerId;
            fame.playerId = player.session.memberId;
        }

        await this.famesRepository.create(fame);
    }

    calculateRate(session, gameData) {
        return !!session ? session.multiplier * gameData.exchangeRates.code[session.currencyCode] : 1;
    }
}
