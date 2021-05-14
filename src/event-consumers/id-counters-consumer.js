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
        this.gameName = gameName;
        this.idCountersRepository = idCountersRepository;
    }

    async consume(modelNamePostFix) {
        const filter = {
            m: `${this.gameName}_${modelNamePostFix}`,
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

    async getLatestId(modelNamePostFix) {
        const latestCounter = await this.idCountersRepository
            .findOne({ m: `${this.gameName}_${modelNamePostFix}` }, "c")
            .lean()
            .exec();

        return latestCounter?.c ?? 0;
    }

    async updateLatestId(modelNamePostFix, id) {
        const filter = {
            m: `${this.gameName}_${modelNamePostFix}`,
            f: "id",
        };

        const updateOptions = {
            setDefaultsOnInsert: true,
            upsert: true,
            fields: { c: id },
        };

        await this.idCountersRepository.findOneAndUpdate(filter, updateOptions);
    }
}
