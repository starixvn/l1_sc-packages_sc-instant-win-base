import mongoose from "mongoose";
import GameData from "sc-game-base/src/core/game-data";
import { CurrencyRateHelper } from "./../helpers";

export default class HallOfFameConsumer {
    /**
     * @param {mongoose.Model} famesRepository
     * @param {GameData} dependencies.gameData
     */
    constructor(famesRepository, gameData) {
        this.famesRepository = famesRepository;
        this.gameData = gameData;
    }

    async add(player, { roundId, bet, totalAmount, winningAmount, numberOfPaylines, freeSpin = false }) {
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
        };

        if (!!player.session) {
            fame.memberId = player.session.memberId;
            fame.partnerId = player.session.partnerId;
            fame.currency = player.session.currency;
            fame.rate = CurrencyRateHelper.calculateRate(player.session, this.gameData);
        }

        await this.famesRepository.create(fame);
    }
}
