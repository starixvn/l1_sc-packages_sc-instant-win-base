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
        await this.famesRepository.create({
            uid: player.UID,
            memberId: player.session?.memberId,
            name: player.profile.name,
            roundId,
            bet,
            totalAmount,
            winningAmount,
            numberOfPaylines,
            freeSpin,
            time: new Date(),
            partnerId: player.session?.partnerId,
            currency: player.session?.currency,
            rate: CurrencyRateHelper.calculateRate(player.session, this.gameData),
        });
    }
}
