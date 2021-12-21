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

describe("calculateRate", () => {
    it("when not have session should return 1", () => {
        // arrange
        const gameData = { exchangeRates: { code: [] } };
        const fameConsumer = new HallOfFameConsumer(famesRepository, gameData);
        const session = null;
        const expectedValue = 1;

        // act
        const actualValue = fameConsumer.calculateRate(session, gameData);

        // assert
        expect(actualValue).toStrictEqual(expectedValue);
    });

    it("when have session should return correct value", () => {
        // arrange
        const gameData = { exchangeRates: { code: { INH: 1 } } };
        const fameConsumer = new HallOfFameConsumer(famesRepository, gameData);
        const session = { multiplier: 1000, currencyCode: "INH" };
        const expectedValue = 1000;

        // act
        const actualValue = fameConsumer.calculateRate(session, gameData);

        // assert
        expect(actualValue).toStrictEqual(expectedValue);
    });
});
