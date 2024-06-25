import { stub, stubMongoose } from "jest-micro-auto-stub";
import math from "lodash/math";
import mongoose from "mongoose";
import { logger } from "sc-common/logger";
import { JackpotPublisher } from "../../event-publishers";
import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";
import JackpotConsumer from "../jackpot-consumer";
import currencyData from "./currency-data.json";

const gameData = stubGameData();
const gameDefinition = stubGameDefinition();

/** @type {mongoose.Model}*/
const jackpotsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const currencyGroupGamesRepository = stubMongoose(mongoose.Model);

const jackpotPublisher = stub(JackpotPublisher);
const logService = stub(logger);

describe("JackpotConsumer", () => {
    let consumer;

    beforeEach(() => {
        consumer = initConsumer();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("contribute", () => {
        const pool = 1000;

        const player = {};
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId, rate: 1 };

        it("should call contributeToPool with approriate prize and base amount", async () => {
            // arrange
            spyOn(consumer, "contributeToPool");
            const poolConfigs = { bot: 0.01, contribute: 0.1, init: 5000 };
            const expectedParams = { baseTotalAmount: 5, contributedByMember: false, prize: "minor", roundId: gameData.roundId, pool: poolConfigs };

            // act
            await consumer.contribute(player, bet);

            // assert
            expect(consumer.contributeToPool).toBeCalledWith(expectedParams);
        });

        it("should call contributeToPool for all prizes", async () => {
            // arrange
            spyOn(consumer, "contributeToPool");

            // act
            await consumer.contribute(player, bet);

            // assert
            expect(consumer.contributeToPool).toBeCalledTimes(3);
        });
    });

    //TODO add more tests for contribution calculation
    // describe("contribution amount calculation", () => {
    //     const paylines = [1, 12, 25];
    //     const testData = [];
    //     const { exchangeRate, currencies } = currencyData;
    //     for (const currency of currencies) {
    //         for (const stakeLevel of currency.stakeLevels) {
    //             for (const payline of paylines) {
    //                 testData.push([
    //                     { ...currency, payline, stakeLevel },
    //                     math.round(
    //                         stakeLevel *
    //                             payline *
    //                             currency.multiplier *
    //                             exchangeRate[currency.code] *
    //                             gameData.gameConfigs.slotsConfig.jackpot.playerContributionRatio,
    //                         4
    //                     ),
    //                 ]);
    //             }
    //         }
    //     }

    //     it.each(testData)("%j base contribution amount should be %d", async (currency, expectedContributionAmount) => {
    //         // arrange
    //         const consumer = initConsumer();
    //         const bet = {
    //             pool: currency.stakeLevel,
    //             totalAmount: currency.stakeLevel * currency.payline,
    //             rate: exchangeRate[currency.code] * currency.multiplier,
    //             roundId: gameData.roundId,
    //         };
    //         const baseStakeLevel = gameData.gameConfigs.slotsConfig.stakeLevels[currency.stakeLevels.indexOf(currency.stakeLevel)].stake;
    //         spyOn(consumer, "getBasePool").and.returnValue(baseStakeLevel);
    //         jackpotsRepository.findOneAndUpdate.mockReturnValueOnce({
    //             amount: expectedContributionAmount,
    //         });
    //         const runningPoolFilter = {
    //             gameId: gameDefinition.id,
    //             pool: baseStakeLevel,
    //             winnerName: { $exists: false },
    //             createdAt: { $lte: gameData.roundId },
    //         };
    //         const poolAdjustment = {
    //             amount: expectedContributionAmount,
    //             byBots: 0,
    //             byMembers: expectedContributionAmount,
    //         };

    //         // act
    //         await consumer.contribute({ session: { multiplier: currency.multiplier } }, bet);

    //         // assert
    //         expect(jackpotsRepository.findOneAndUpdate).toBeCalledWith(
    //             runningPoolFilter,
    //             {
    //                 gameId: gameDefinition.id,
    //                 $inc: poolAdjustment,
    //             },
    //             sort
    //         );
    //     });
    // });
    describe("calculatePoolAdjustment", () => {
        it("always return approriate format", () => {
            // arrange
            const poolConfig = { bot: 0.01, contribute: 0.1, init: 5000 };

            // act
            const adjustment = consumer.calculatePoolAdjustment({ contributedByMember: false, poolConfig, baseTotalAmount: 5 });

            // assert
            expect(adjustment).not.toBeNull();
            expect(adjustment.amount).toBeNumber();
            expect(adjustment.byBots).toBeNumber();
            expect(adjustment.byMembers).toBeNumber();
        });

        describe("when contributedByMember is true", () => {
            const poolConfig = { bot: 0.01, contribute: 0.1, init: 5000 };

            it("should return byBots equal 0", () => {
                // arrange

                // act
                const adjustment = consumer.calculatePoolAdjustment({ contributedByMember: true, poolConfig, baseTotalAmount: 5 });
                // assert
                expect(adjustment.byBots).toBe(0);
            });

            it("should return correct byMembers", () => {
                // arrange
                const expected = 5 * poolConfig.contribute;

                // act
                const adjustment = consumer.calculatePoolAdjustment({ contributedByMember: true, poolConfig, baseTotalAmount: 5 });

                // assert
                expect(adjustment.byMembers).toBe(expected);
            });
        });

        describe("when contributedByMember is false", () => {
            const poolConfig = { bot: 0.01, contribute: 0.1, init: 5000 };

            it("should return correct byBots ", () => {
                // arrange
                const expected = 5 * poolConfig.bot;

                // act
                const adjustment = consumer.calculatePoolAdjustment({ contributedByMember: false, poolConfig, baseTotalAmount: 5 });
                // assert
                expect(adjustment.byBots).toBe(expected);
            });

            it("should return byMembers equal 0", () => {
                // arrange

                // act
                const adjustment = consumer.calculatePoolAdjustment({ contributedByMember: false, poolConfig, baseTotalAmount: 5 });

                // assert
                expect(adjustment.byMembers).toBe(0);
            });
        });
    });

    describe("contributeToPool", () => {
        const sort = {
            new: true,
            lean: true,
            fields: { _id: false, amount: true },
            sort: {
                createdAt: -1,
            },
        };

        const poolConfigs = { bot: 0.01, contribute: 0.1, init: 5000 };
        const betContribution = {
            baseTotalAmount: 5,
            contributedByMember: false,
            roundId: gameData.roundId,
            pool: poolConfigs,
        };

        it("should call calculatePoolAdjustment with approriate params", async () => {
            // arrange
            spyOn(consumer, "calculatePoolAdjustment");
            jackpotsRepository.findOneAndUpdate.mockReturnValueOnce({
                amount: 12,
            });

            // act
            await consumer.contributeToPool(betContribution);

            // assert
            expect(consumer.calculatePoolAdjustment).toBeCalledWith({
                baseTotalAmount: betContribution.baseTotalAmount,
                contributedByMember: betContribution.contributedByMember,
                poolConfig: betContribution.pool,
            });
        });

        it("should update approriate pool adjustment", async () => {
            // arrange
            const jackpotPrize = "minor";
            const runningPoolFilter = {
                gameId: gameDefinition.id,
                prize: jackpotPrize,
                winnerName: { $exists: false },
                createdAt: { $lte: gameData.roundId },
            };

            const poolAdjustment = {
                amount: 50,
                byBots: 0,
                byMembers: 0.5,
            };
            jackpotsRepository.findOneAndUpdate.mockReturnValueOnce({
                amount: 12,
            });

            spyOn(consumer, "calculatePoolAdjustment").and.returnValue(poolAdjustment);

            // act
            await consumer.contributeToPool({ ...betContribution, prize: jackpotPrize });

            // assert
            expect(jackpotsRepository.findOneAndUpdate).toBeCalledWith(
                runningPoolFilter,
                {
                    gameId: gameDefinition.id,
                    $inc: poolAdjustment,
                },
                sort
            );
        });

        it("should publish latest jackpot amount", async () => {
            // arrange
            const jackpotPrize = "grand";
            const latestJackpot = 12;
            jackpotsRepository.findOneAndUpdate.mockReturnValueOnce({
                amount: latestJackpot,
            });

            spyOn(consumer, "calculatePoolAdjustment").and.returnValue({});

            // act
            await consumer.contributeToPool({ ...betContribution, prize: jackpotPrize });

            // assert
            expect(jackpotPublisher.publishLatestPool).toBeCalledWith({ pool: jackpotPrize, amount: latestJackpot });
        });
    });
});

describe("hit", () => {
    const pool = 1000;

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

    const testCases = [{ session: { playerId: 12, currencyGroupId: "617a650628b7a500016388f5" } }, { session: null }];

    it.each(testCases)("should call initializeNewPool", async (testCase) => {
        // arrange
        const consumer = initConsumer();
        const player = { profile: { name: "A" }, session: testCase.session };
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId };
        spyOn(consumer, "getBasePool").and.returnValue(pool);

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
        const player = { profile: { name: "A" }, session: { playerId: 12, currencyGroupId: "617a650628b7a500016388f5" } };
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId };
        spyOn(consumer, "initializeNewPool");
        spyOn(consumer, "getBasePool").and.returnValue(pool);

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
        const player = { UID: "uid", profile: { name: "A" }, session: { playerId: 12 } };
        const bet = { pool, totalAmount: 5, roundId: gameData.roundId };
        const winningJackpot = { amount: 12000 };
        jackpotsRepository.findOneAndUpdate.mockReturnValueOnce(winningJackpot);
        spyOn(consumer, "getBasePool").and.returnValue(pool);
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
        const player = { profile: { name: "A" }, session: { playerId: 12 } };
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
        const player = { profile: { name: "A" }, session: { playerId: 12 } };
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

        const player = { profile: { name: "A" }, session: { playerId: 12 } };
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
            betLevels: [0.1, 1, 5],
            jackpot: {
                enabled: true,
                excludeTestCurrency: false,
                winningRatio: 0.98,
                pools: {
                    minor: { init: 5000, contribute: 0.1, bot: 0.01 },
                    major: { init: 25000, contribute: 0.15, bot: 0.015 },
                    grand: { init: 50000, contribute: 0.25, bot: 0.025 },
                },
                allowedCurrency: "INH",
            },
        },
    };
    gameData.freeSpinId = 1;
    gameData.exchangeRates = {
        code: [1],
    };

    gameData.currencyGroupGames = [{ groupId: "617a650628b7a500016388f5", betLevels: [0.1, 1, 5] }];

    return gameData;
}

function stubGameDefinition() {
    return new SlotGameDefinition({
        id: 2,
        choices: [1, 2, 3, 4, 5],
    });
}
