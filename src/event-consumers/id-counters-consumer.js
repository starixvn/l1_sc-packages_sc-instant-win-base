import mongoose from "mongoose";

export default class IdCountersConsumer {
    /**
     * @param {String} gameName
     * @param {mongoose.Model} idCountersRepository
     */
    constructor(gameName, idCountersRepository) {
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

        const updates = {
            $set: { c: id },
        };

        const updateOptions = {
            setDefaultsOnInsert: true,
            upsert: true,
        };

        await this.idCountersRepository.findOneAndUpdate(filter, updates, updateOptions);
    }
}
