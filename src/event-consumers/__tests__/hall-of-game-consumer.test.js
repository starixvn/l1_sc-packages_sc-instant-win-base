import { stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import { HallOfFameConsumer } from "..";

/** @type {mongoose.Model}*/
const famesRepository = stubMongoose(mongoose.Model);

describe("add", () => {
    const testCases = [
        {
            session: { memberId: 12, playerId: 12 },
            fame: {
                roundId: 1,
                bet: 5,
                totalAmount: 5,
                winningAmount: 25,
                numberOfPaylines: 5,
                freeSpin: false,
            },
            exchangeRates: { code: {} },
        },
        {
            session: { memberId: 12, playerId: 12 },
            fame: {
                roundId: 1,
                bet: 5,
                totalAmount: 5,
                winningAmount: 25,
                numberOfPaylines: 5,
                freeSpin: false,
                rate: 10,
            },
            exchangeRates: { code: { UUS: 1 } },
        },
        {
            session: null,
            fame: {
                roundId: 1,
                bet: 5,
                totalAmount: 5,
                winningAmount: 25,
                numberOfPaylines: 5,
                rate: 10,
            },
            exchangeRates: { code: { UUS: 1 } },
        },
    ];
    it.each(testCases)("should create new record in fames repository", async (testCase) => {
        // arrange
        const gameData = { exchangeRates: testCase.exchangeRates };
        const fameConsumer = new HallOfFameConsumer(famesRepository, gameData);
        const player = {
            UID: "uid",
            session: testCase.session,
            profile: { name: "a" },
        };
        const fame = testCase.fame;

        // act
        await fameConsumer.add(player, fame);

        // assert
        expect(famesRepository.create).toBeCalled();
    });
});
