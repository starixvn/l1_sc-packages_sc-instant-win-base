import { stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import { HallOfFameQuery } from "..";

const famesRepository = stubMongoose(mongoose.Model);
const jackpotsRepository = stubMongoose(mongoose.Model);
const exchangeRatesRepository = stubMongoose(mongoose.Model);

describe("queryBigWinningWinners", () => {
    it("should return empty when page < 1", async () => {
        // arrange
        const fameQuery = new HallOfFameQuery(1, famesRepository, jackpotsRepository);
        const player = {};

        // act
        const actualResult = await fameQuery.queryBigWinningWinners(player, 0);

        // assert
        expect(actualResult).toEqual({ bigWinningWinners: {} });
    });

    it("when not have big winners should return empty", async () => {
        // arrange
        const gameData = { exchangeRates: { code: [] } };
        const fameQuery = new HallOfFameQuery(1, famesRepository, jackpotsRepository, gameData);

        famesRepository.find().lean().exec.mockReturnValueOnce(null);
        famesRepository.countDocuments.mockReturnValue({ exec: jest.fn() });
        famesRepository.countDocuments().exec.mockReturnValueOnce(0);
        const player = {};

        // act
        const actualResult = await fameQuery.queryBigWinningWinners(player, 1);

        // assert
        expect(actualResult.bigWinningWinners.total).toEqual(0);
        expect(actualResult.bigWinningWinners.winners).toStrictEqual([]);
    });

    it("should return data when page >= 1", async () => {
        // arrange
        const fameQuery = new HallOfFameQuery(1, famesRepository, jackpotsRepository, exchangeRatesRepository);

        famesRepository
            .find()
            .lean()
            .exec.mockReturnValueOnce([
                { name: "a", totalAmount: 2, winningAmount: 7, freeSpin: false, exchangeRateId: 1 },
                { name: "b", totalAmount: 1, winningAmount: 7, freeSpin: true, rate: 1 },
            ]);

        famesRepository.countDocuments.mockReturnValue({ exec: jest.fn() });
        famesRepository.countDocuments().exec.mockReturnValueOnce(2);
        const player = { session: {} };

        exchangeRatesRepository.findOne().lean().exec.mockReturnValue({ code: [] });

        // act
        const actualResult = await fameQuery.queryBigWinningWinners(player, 1);

        // assert
        expect(actualResult.bigWinningWinners.total).toEqual(2);
        expect(actualResult.bigWinningWinners.winners).not.toBeEmpty();
    });

    it("should convert amount to base amount", async () => {
        // arrange
        const fameQuery = new HallOfFameQuery(1, famesRepository, jackpotsRepository, exchangeRatesRepository);

        famesRepository
            .find()
            .lean()
            .exec.mockReturnValueOnce([
                { name: "a", totalAmount: 2, winningAmount: 7, freeSpin: false, rate: 1.5 },
                { name: "b", totalAmount: 1, winningAmount: 7, freeSpin: true, rate: 1 },
                { name: "c", totalAmount: 3, winningAmount: 10, freeSpin: false, rate: 1000 },
            ]);

        famesRepository.countDocuments.mockReturnValue({ exec: jest.fn() });
        famesRepository.countDocuments().exec.mockReturnValueOnce(2);
        const player = { session: {} };

        exchangeRatesRepository.findOne().lean().exec.mockReturnValue({ code: [] });

        // act
        const actualResult = await fameQuery.queryBigWinningWinners(player, 1);

        // assert
        expect(actualResult.bigWinningWinners.total).toEqual(2);
        expect(actualResult.bigWinningWinners.winners).toEqual([
            { name: "a", totalAmount: 2, winningAmount: 7, freeSpin: false, rate: 1.5, baseTotalAmount: 3, baseWinningAmount: 10.5 },
            { name: "b", totalAmount: 1, winningAmount: 7, freeSpin: true, rate: 1, baseTotalAmount: 1, baseWinningAmount: 7 },
            { name: "c", totalAmount: 3, winningAmount: 10, freeSpin: false, rate: 1000, baseTotalAmount: 3000, baseWinningAmount: 10000 },
        ]);
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
        const gameData = { exchangeRates: { code: [] } };
        const fameQuery = new HallOfFameQuery(1, famesRepository, jackpotsRepository, gameData);
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
