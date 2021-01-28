import mongoose from "mongoose";

import SlotGameData from "./../slot-game-data";

export default class IdCountersConsumer {
    /**
     * @param {String} gameName
     * @param {SlotGameData} gameData
     * @param {mongoose.Model} idCountersRepository
     */
    constructor(gameName, gameData, idCountersRepository) {
        this.gameData = gameData;
        this.modelName = `${gameName}_round`;
        this.idCountersRepository = idCountersRepository;
    }

    async consume() {
        const filter = {
            m: this.modelName,
            f: "id",
        };
        const increment = { $inc: { c: 1 } };
        const updateOptions = {
            new: true,
            lean: true,
            setDefaultsOnInsert: true,
            upsert: true,
            fields: { c: 1 },
        };
        const latestCounter = await this.idCountersRepository.findOneAndUpdate(filter, increment, updateOptions);

        return latestCounter.c;
    }

    async getLatestId() {
        const latestCounter = await this.idCountersRepository.findOne({ m: this.modelName }, "c").lean().exec();

        return latestCounter?.c ?? 0;
    }
}
