import { IdCounters } from "./../models";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class IdCountersConsumer {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     */
    constructor(definition, gameData) {
        this.gameData = gameData;
        this.modelName = `${definition.name}_round`;
    }

    async consume() {
        const filter = {
            m: this.modelName,
            f: "id",
        };
        const increment = { c: 1 };
        const updateOptions = {
            new: true,
            lean: true,
            setDefaultsOnInsert: true,
            upsert: true,
            fields: { c: 1 },
        };
        const latestCounter = await IdCounters.findOneAndUpdate(filter, increment, updateOptions);

        return latestCounter.c;
    }

    async getLatestId() {
        const latestCounter = await IdCounters.findOne({ m: this.modelName }, "c").lean().exec();

        return latestCounter.c;
    }
}
