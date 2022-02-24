import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { logger } from "sc-common/logger";

import { JackpotPublisher } from "../../event-publishers";
import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";
import JackpotConsumer from "../jackpot-consumer";

const gameData = stubGameData();
const gameDefinition = stubGameDefinition();

/** @type {mongoose.Model}*/
const jackpotsRepository = stubMongooseModelStupidly(mongoose.Model);

/** @type {mongoose.Model}*/
const currencyGroupGamesRepository = stubMongooseModelStupidly(mongoose.Model);

const jackpotPublisher = stub(JackpotPublisher);
const logService = stub(logger);

describe("contribute", () => {
    const pool = 1;
    const runningPoolFilter = {
        gameId: gameDefinition.id,
        pool,
        winnerName: { $exists: false },
        createdAt: { $lte: gameData.roundId },
    };

    const sort = {
        new: true,
        lean: true,
        fields: { _id: false, amount: true },
        sort: {
            createdAt: -1,
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("when not find base pool should logCritical and return", async () => {
        // arrange
        const consumer = initConsumer();
        spyOn(consumer, "getBasePool").and.returnValue(null);
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId };
        const player = { session: {} };

        // act
        await consumer.contribute(player, bet);

        // assert
        expect(logService.logCritical).toBeCalled();
        expect(jackpotPublisher.publishLatestPool).not.toBeCalled();
    });

    it("should update approriate contribution for bot and publish pool info", async () => {
        // arrange
        const consumer = initConsumer();
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId };
        jackpotsRepository.findOneAndUpdate.mockReturnValueOnce({
            amount: 12,
        });

        spyOn(consumer, "getBasePool").and.returnValue(1);
        const contributeAmount = 5 * gameData.gameConfigs.slotsConfig.jackpot.botContributionRatio;
        const poolAdjustment = {
            amount: contributeAmount,
            byBots: contributeAmount,
            byMembers: 0,
            byPlayers: 0,
        };
        const player = {};

        // act
        await consumer.contribute(player, bet);

        // assert
        expect(jackpotsRepository.findOneAndUpdate).toBeCalledWith(
            runningPoolFilter,
            {
                $inc: poolAdjustment,
            },
            sort
        );
        expect(jackpotPublisher.publishLatestPool).toBeCalledWith({ pool, amount: 12 });
    });

    it("should update approriate contribution for player and publish pool info", async () => {
        // arrange
        const consumer = initConsumer();
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId };
        jackpotsRepository.findOneAndUpdate.mockReturnValueOnce({
            amount: 12,
        });
        const contributeAmount = 5 * gameData.gameConfigs.slotsConfig.jackpot.playerContributionRatio;
        const poolAdjustment = {
            amount: contributeAmount,
            byBots: 0,
            byMembers: contributeAmount,
            byPlayers: contributeAmount,
        };

        // act
        await consumer.contribute({ session: { multiplier: 1, currencyCode: 0, currencyGroupId: "617a650628b7a500016388f5" } }, bet);

        // assert
        expect(jackpotsRepository.findOneAndUpdate).toBeCalledWith(
            runningPoolFilter,
            {
                $inc: poolAdjustment,
            },
            sort
        );
        expect(jackpotPublisher.publishLatestPool).toBeCalledWith({ pool, amount: 12 });
    });
});

describe("hit", () => {
    const pool = 1;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("when not find base pool should logCritical and return", async () => {
        // arrange
        const consumer = initConsumer();
        spyOn(consumer, "getBasePool").and.returnValue(null);
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId };
        const player = { session: {} };

        // act
        await consumer.hit(player, bet);

        // assert
        expect(logService.logCritical).toBeCalled();
        expect(jackpotPublisher.publishLatestPool).not.toBeCalled();
    });

    const testCases = [{ session: { memberId: 12, playerId: 12, currencyGroupId: "617a650628b7a500016388f5" } }, { session: null }];

    it.each(testCases)("should call initializeNewPool", async (testCase) => {
        // arrange
        const consumer = initConsumer();
        const player = { profile: { name: "A" }, session: testCase.session };
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId };

        spyOn(consumer, "initializeNewPool");

        // act
        await consumer.hit(player, bet);

        // assert
        expect(consumer.initializeNewPool).toBeCalledWith(bet.pool, gameData.roundId);
        expect(jackpotsRepository.findOneAndUpdate).toBeCalled();
    });

    it("when no winning jackpot should log error and return 0", async () => {
        // arrange
        const consumer = initConsumer();
        const player = { profile: { name: "A" }, session: { memberId: 12, playerId: 12, currencyGroupId: "617a650628b7a500016388f5" } };
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId };
        spyOn(consumer, "initializeNewPool");
        spyOn(consumer, "getBasePool").and.returnValue(1);

        // act
        const jackpot = await consumer.hit(player, bet);

        // assert
        expect(consumer.initializeNewPool).toBeCalledWith(bet.pool, gameData.roundId);
        expect(jackpotsRepository.findOneAndUpdate).toBeCalled();
        expect(logService.logCritical).toBeCalled();
        expect(jackpot).toStrictEqual({ amount: 0 });
    });

    it("should publish winning jackpot amount", async () => {
        // arrange
        const consumer = initConsumer();
        const player = { UID: "uid", profile: { name: "A" }, session: { playerId: 12, memberId: 12 } };
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId };
        const winningJackpot = { amount: 12000 };
        jackpotsRepository.findOneAndUpdate.mockReturnValueOnce(winningJackpot);
        spyOn(consumer, "getBasePool").and.returnValue(1);
        const expectJackpotAmount = { amount: winningJackpot.amount * gameData.gameConfigs.slotsConfig.jackpot.winningRatio };

        spyOn(consumer, "initializeNewPool");

        // act
        const jackpot = await consumer.hit(player, bet);

        // assert
        expect(jackpot).toStrictEqual(expectJackpotAmount);
        expect(jackpotPublisher.publishWinner).toBeCalledWith(player.UID, jackpot);
    });
});

describe("initialize", () => {
    const pool = 1;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should call initializeNewPool", async () => {
        // arrange
        const consumer = initConsumer();
        const player = { profile: { name: "A" }, session: { playerId: 12, memberId: 12 } };
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId };
        jackpotsRepository.countDocuments.mockReturnValue({ exec: jest.fn() });
        jackpotsRepository.countDocuments().exec.mockReturnValue(0);

        spyOn(consumer, "initializeNewPool");

        // act
        await consumer.initialize(player, bet);

        // assert
        expect(consumer.initializeNewPool).toBeCalledTimes(3);
    });

    it("should logCritical if exist pool", async () => {
        // arrange
        const consumer = initConsumer();
        const player = { profile: { name: "A" }, session: { memberId: 12 } };
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId };
        jackpotsRepository.countDocuments.mockReturnValue({ exec: jest.fn() });
        jackpotsRepository.countDocuments().exec.mockReturnValue(2);

        spyOn(consumer, "initializeNewPool");

        // act
        await consumer.initialize(player, bet);

        // assert
        expect(logService.logCritical).toBeCalledTimes(3);
        expect(consumer.initializeNewPool).not.toBeCalled();
    });

    it("when not have stakeLevels should not call initializeNewPool", async () => {
        // arrange
        const gd = stubGameData();
        gd.gameConfigs.slotsConfig = null;
        const consumer = new JackpotConsumer(gameDefinition, gd, jackpotPublisher, logService, jackpotsRepository, currencyGroupGamesRepository);

        const player = { profile: { name: "A" }, session: { playerId: 12, memberId: 12 } };
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId };
        jackpotsRepository.countDocuments.mockReturnValue({ exec: jest.fn() });
        jackpotsRepository.countDocuments().exec.mockReturnValue(0);

        spyOn(consumer, "initializeNewPool");

        // act
        await consumer.initialize(player, bet);

        // assert
        expect(consumer.initializeNewPool).not.toBeCalled();
    });
});

describe("initializeNewPool", () => {
    const pool = 1;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should create pool and log", async () => {
        // arrange
        const consumer = initConsumer();

        // act
        await consumer.initializeNewPool(pool, gameData.roundId);

        // assert
        expect(jackpotsRepository.create).toBeCalledTimes(1);
        expect(logService.log).toBeCalledTimes(1);
    });
});

describe("getLatestRoundId", () => {
    const pool = 1;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return value get from jackpotsRepository", async () => {
        // arrange
        const consumer = initConsumer();
        jackpotsRepository.findOne().lean().exec.mockReturnValueOnce({
            createdAt: 1,
        });

        // act
        const roundId = await consumer.getLatestRoundId();

        // assert
        expect(roundId).toBe(1);
    });
});

describe("getBasePool", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("when not have session should return null", async () => {
        // arrange
        const consumer = initConsumer();
        const player = {};
        const stake = 1;

        // act
        const basePool = consumer.getBasePool(player, stake);

        // assert
        expect(basePool).toBe(null);
    });

    it("when not have base stake levels should return null", async () => {
        // arrange
        const gd = stubGameData();
        gd.gameConfigs.slotsConfig = null;
        const consumer = new JackpotConsumer(gameDefinition, gd, jackpotPublisher, logService, jackpotsRepository, currencyGroupGamesRepository);

        const player = { session: {} };
        const stake = 1;
        const expectedValue = null;

        // act
        const basePool = consumer.getBasePool(player, stake);

        // assert
        expect(basePool).toBe(expectedValue);
    });

    it("when not have currency stake levels should return null", async () => {
        // arrange
        const cg = stubMongooseModelStupidly(mongoose.Model);
        cg.findOne().lean().exec.mockReturnValue(null);
        const consumer = new JackpotConsumer(gameDefinition, gameData, jackpotPublisher, logService, jackpotsRepository, cg);

        const player = { session: {} };
        const stake = 1;
        const expectedValue = null;

        // act
        const basePool = consumer.getBasePool(player, stake);

        // assert
        expect(basePool).toBe(expectedValue);
    });
});

function initConsumer() {
    return new JackpotConsumer(gameDefinition, gameData, jackpotPublisher, logService, jackpotsRepository, currencyGroupGamesRepository);
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
            jackpot: {
                playerContributionRatio: 0.025,
                botContributionRatio: 0.005,
                winningRatio: 0.98,
            },
        },
    };
    gameData.freeSpinId = 1;
    gameData.exchangeRates = {
        code: [1],
    };

    gameData.currencyGroupGames = [{ groupId: "617a650628b7a500016388f5", stakeLevels: [{ stake: 0.1 }, { stake: 1 }, { stake: 5 }] }];

    return gameData;
}

function stubGameDefinition() {
    return new SlotGameDefinition({
        id: 2,
        choices: [1, 2, 3, 4, 5],
    });
}
