import { stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import { HallOfFameQuery } from "..";

/** @type {mongoose.Model}*/
const famesRepository = stubMongooseModelStupidly(mongoose.Model);
/** @type {mongoose.Model}*/
const jackpotsRepository = stubMongooseModelStupidly(mongoose.Model);

describe("queryBigWinningWinners", () => {
    it("should return empty when page < 1", async () => {
        // arrange
        const fameQuery = new HallOfFameQuery(1, famesRepository, jackpotsRepository);

        // act
        const actualResult = await fameQuery.queryBigWinningWinners(0);

        // assert
        expect(actualResult).toEqual({ bigWinningWinners: {} });
    });

    it("should return data when page >= 1", async () => {
        // arrange
        const fameQuery = new HallOfFameQuery(1, famesRepository, jackpotsRepository);
        famesRepository
            .find()
            .lean()
            .exec.mockReturnValueOnce([
                { name: "a", totalAmount: 2, winningAmount: 7, freeSpin: false },
                { name: "b", totalAmount: 1, winningAmount: 7, freeSpin: true },
            ]);

        famesRepository.countDocuments.mockReturnValue({ exec: jest.fn() });
        famesRepository.countDocuments().exec.mockReturnValueOnce(2);

        // act
        const actualResult = await fameQuery.queryBigWinningWinners(1);

        // assert
        expect(actualResult.bigWinningWinners.total).toEqual(2);
        expect(actualResult.bigWinningWinners.winners).not.toBeEmpty();
    });
});

describe("queryJackpotWinners", () => {
    it("should return empty when page < 1", async () => {
        // arrange
        const fameQuery = new HallOfFameQuery(1, famesRepository, jackpotsRepository);

        // act
        const actualResult = await fameQuery.queryJackpotWinners(0);

        // assert
        expect(actualResult).toEqual({ jackpotWinners: {} });
    });

    it("should return data when page >= 1", async () => {
        // arrange
        const fameQuery = new HallOfFameQuery(1, famesRepository, jackpotsRepository);
        jackpotsRepository
            .find()
            .lean()
            .exec.mockReturnValueOnce([{ hitTime: "2021-06-02", winnerName: "a", amount: 7, pool: 1, winningRatio: 0.98 }]);

        jackpotsRepository.countDocuments.mockReturnValue({ exec: jest.fn() });
        jackpotsRepository.countDocuments().exec.mockReturnValueOnce(1);

        // act
        const actualResult = await fameQuery.queryJackpotWinners(1);

        // assert
        expect(actualResult.jackpotWinners.total).toEqual(1);
        expect(actualResult.jackpotWinners.winners).not.toBeEmpty();
    });
});
