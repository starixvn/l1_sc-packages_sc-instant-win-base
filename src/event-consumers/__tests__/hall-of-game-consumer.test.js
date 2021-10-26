import { stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import { HallOfFameConsumer } from "..";

/** @type {mongoose.Model}*/
const famesRepository = stubMongooseModelStupidly(mongoose.Model);

describe("add", () => {
    const testCases = [
        {
            session: { memberId: 12 },
            fame: {
                roundId: 1,
                bet: 5,
                totalAmount: 5,
                winningAmount: 25,
                numberOfPaylines: 5,
                freeSpin: false,
            },
        },
        {
            session: null,
            fame: {
                roundId: 1,
                bet: 5,
                totalAmount: 5,
                winningAmount: 25,
                numberOfPaylines: 5,
            },
        },
    ];
    it.each(testCases)("should create new record in fames repository", async (testCase) => {
        // arrange
        const gameData = { exchangeRates: { code: [] } };
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
