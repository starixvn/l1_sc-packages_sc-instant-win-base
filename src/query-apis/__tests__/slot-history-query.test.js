import { stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import { SlotHistoryQuery } from "..";

/** @type {mongoose.Model}*/
const roundsRepository = stubMongooseModelStupidly(mongoose.Model);

describe("queryHistory", () => {
    it("should return empty when page < 1", async () => {
        // arrange
        const historyQuery = new SlotHistoryQuery(roundsRepository);

        // act
        const actualResult = await historyQuery.queryHistory({}, 0, 10);

        // assert
        expect(actualResult).toBeEmpty();
    });

    it("should return data when page >= 1", async () => {
        // arrange
        const historyQuery = new SlotHistoryQuery(roundsRepository);
        roundsRepository
            .find()
            .lean()
            .exec.mockReturnValueOnce([
                { id: 1, result: [], settlementResult: { bonus: {} }, bonusChests: [] },
                { id: 2, result: [], settlementResult: { bonus: {} }, bonusChests: [{ amount: 0 }] },
            ]);

        roundsRepository.countDocuments.mockReturnValue({ exec: jest.fn() });
        roundsRepository.countDocuments().exec.mockReturnValueOnce(2);

        // act
        const actualResult = await historyQuery.queryHistory({}, 1, 10);

        // assert
        expect(actualResult.history.page).toEqual(1);
        expect(actualResult.history.pageSize).toEqual(10);
        expect(actualResult.history.total).toEqual(2);
    });
});
