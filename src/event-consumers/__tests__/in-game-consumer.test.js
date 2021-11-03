import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { BaseEventPublishers, RoundQuery } from "sc-game-base/src/core";

import { FreeSpinsConsumer, InGameConsumer } from "../";
import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";

const gameData = stubGameData();
const definition = stubGameDefinition();
const publisher = stub(BaseEventPublishers);
const roundQuery = stub(RoundQuery);

/** @type {mongoose.Model}*/
const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);
/** @type {mongoose.Model}*/
const jackpotsRepository = stubMongooseModelStupidly(mongoose.Model);
const currencyGroupGamesRepository = stubMongooseModelStupidly(mongoose.Model);

const freeSpinsConsumer = stub(FreeSpinsConsumer);
const getBalance = jest.fn();

describe("getPools", () => {
    it("should get pools from jackpot repository", async () => {
        // arrange
        const consumer = createInGameConsumer();
        const expectPools = [{ pool: 1, amount: 1000 }];

        jackpotsRepository.find().lean().exec.mockReturnValueOnce(expectPools);

        // act
        const pools = await consumer.getPools();

        // assert
        expect(pools).toStrictEqual(expectPools);
    });
});

describe("buildPayload", () => {
    it("should contains jackpot pools", async () => {
        // arrange
        const consumer = createInGameConsumer();
        const expectPools = [{ pool: 1, amount: 1000 }];
        jackpotsRepository.find().lean().exec.mockReturnValueOnce(expectPools);

        // act
        const payload = await consumer.buildPayload({ session: { currencyGroupId: "617a650628b7a500016388f5" } });

        // assert
        expect(payload.jackpotPools).not.toBeNull();
        expect(payload.jackpotPools).toStrictEqual(expectPools);
    });

    it("should contains free spins", async () => {
        // arrange
        const consumer = createInGameConsumer();
        const expectedFreeSpins = {
            total: 2,
            bet: 1,
            paylines: [1, 2, 3],
        };

        freeSpinsConsumer.getTotalAvaiableFreeSpins.mockReturnValueOnce(expectedFreeSpins.total);
        freeSpinsConsumer.getSoonestExpiredFreeSpinSet.mockReturnValueOnce({
            bet: expectedFreeSpins.bet,
            paylines: expectedFreeSpins.paylines,
        });

        // act
        const payload = await consumer.buildPayload({ session: {} });

        // assert
        expect(payload.freeSpins).not.toBeNull();
        expect(payload.freeSpins).toStrictEqual(expectedFreeSpins);
    });
});

function createInGameConsumer() {
    return new InGameConsumer({
        definition,
        gameData,
        roundQuery,
        publisher,
        freeSpinsConsumer,
        getBalance,
        userInfosRepository,
        jackpotsRepository,
        currencyGroupGamesRepository,
    });
}

function stubGameData() {
    const gameData = new SlotGameData();

    gameData.remainingTime = 20;
    gameData.gameConfigs = {
        enabled: true,
        minbet: 1,
        maxbet: 1000,
        slotsConfig: {
            stakeLevels: [{ stake: 0.1 }, { stake: 1 }, { stake: 5 }],
            icons: [],
            jackpot: {
                winningRatio: 0.98,
            },
        },
    };

    gameData.stakeLevels = [{ groupId: "617a650628b7a500016388f5", stakeLevels: [{ stake: 0.1 }, { stake: 1 }, { stake: 5 }] }];
    return gameData;
}

function stubGameDefinition() {
    return new SlotGameDefinition({
        id: 1,
        choices: [1, 2, 3, 4, 5],
    });
}
