import { stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import { IdCountersConsumer } from "..";

/** @type {mongoose.Model}*/
const idCountersRepository = stubMongoose(mongoose.Model);

describe("getLatestId", () => {
    it("should return 0 if no data", async () => {
        // arrange
        const consumer = new IdCountersConsumer("4guards", idCountersRepository);

        // act
        const result = await consumer.getLatestId("round");

        // assert
        expect(result).toBe(0);
    });

    it("should return approriate id from id counter", async () => {
        // arrange
        const consumer = new IdCountersConsumer("4guards", idCountersRepository);
        idCountersRepository.findOne().lean().exec.mockReturnValueOnce({
            c: 363714,
            f: "id",
            m: "4guards_round",
        });

        // act
        const result = await consumer.getLatestId("round");

        // assert
        expect(result).toBe(363714);
    });
});

describe("updateLatestId", () => {
    it("should update with approriate game name and model name", async () => {
        // arrange
        const consumer = new IdCountersConsumer("4guards", idCountersRepository);

        // act
        await consumer.updateLatestId("round", 123);

        // assert
        expect(idCountersRepository.findOneAndUpdate).toHaveBeenCalledWith(
            { m: "4guards_round", f: "id" },
            { $set: { c: 123 } },
            {
                setDefaultsOnInsert: true,
                upsert: true,
            }
        );
    });
});

describe("consume", () => {
    it("should increase id and return data", async () => {
        // arrange
        const consumer = new IdCountersConsumer("4guards", idCountersRepository);
        idCountersRepository.findOneAndUpdate.mockReturnValueOnce({
            c: 363714,
            f: "id",
            m: "4guards_round",
        });

        // act
        const id = await consumer.consume("round");

        // assert
        expect(idCountersRepository.findOneAndUpdate).toHaveBeenCalledWith(
            { m: "4guards_round", f: "id" },
            { $inc: { c: 1 } },
            {
                new: true,
                lean: true,
                setDefaultsOnInsert: true,
                upsert: true,
                fields: { c: 1 },
            }
        );
        expect(id).toBe(363714);
    });
});
