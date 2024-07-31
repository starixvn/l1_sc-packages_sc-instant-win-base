import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { logger } from "sc-common/logger";
import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";
import { jackpotPublisher, jackpotValidator } from "../__tests__/stubs";
import JackpotConsumer from "../jackpot-consumer";

const gameData = stubGameData();
const gameDefinition = stubGameDefinition();

/** @type {mongoose.Model}*/
const jackpotsRepository = stubMongoose(mongoose.Model);

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

        describe("when player can contribute", () => {
            beforeEach(() => {
                jackpotValidator.canContributeJackpotPools.mockReturnValueOnce(true);
            });

            it("should call contribute with approriate prize and base amount", async () => {
                // arrange
                spyOn(consumer, "contributeToPool");
                const poolConfigs = { init: 5000, playerSettings: { contrib: 0.1, alloc: 90 }, botSettings: { contrib: 0.01, alloc: 80 } };
                const expectedParams = {
                    baseTotalAmount: 5,
                    contributedByMember: false,
                    prize: "minor",
                    roundId: gameData.roundId,
                    pool: poolConfigs,
                };

                // act
                await consumer.contribute(player, bet);

                // assert
                expect(consumer.contributeToPool).toHaveBeenCalledWith(expectedParams);
            });

            it("should call contribute for all prizes", async () => {
                // arrange
                spyOn(consumer, "contributeToPool");

                // act
                await consumer.contribute(player, bet);

                // assert
                expect(consumer.contributeToPool).toBeCalledTimes(3);
            });
        });

        describe("when player can NOT contribute", () => {
            beforeEach(() => {
                jackpotValidator.canContributeJackpotPools.mockReturnValueOnce(false);
            });

            it("should NOT contribute to pool", async () => {
                // arrange
                spyOn(consumer, "contributeToPool");
                const poolConfigs = { bot: 0.01, contribute: 0.1, init: 5000 };
                const expectedParams = {
                    baseTotalAmount: 5,
                    contributedByMember: false,
                    prize: "minor",
                    roundId: gameData.roundId,
                    pool: poolConfigs,
                };

                // act
                await consumer.contribute(player, bet);

                // assert
                expect(consumer.contributeToPool).not.toHaveBeenCalled();
            });
        });
    });

    describe("calculatePoolAdjustment", () => {
        it("always return approriate format", () => {
            // arrange
            const poolConfig = { init: 5000, playerSettings: { contrib: 0.1, alloc: 90 }, botSettings: { contrib: 0.01, alloc: 80 } };

            // act
            const adjustment = consumer.calculatePoolAdjustment({ contributedByMember: false, poolConfig, baseTotalAmount: 5 });

            // assert
            expect(adjustment).not.toBeNull();
            expect(adjustment.amount).toBeNumber();
            expect(adjustment.byBots).toBeNumber();
            expect(adjustment.byMembers).toBeNumber();
        });

        describe("when contribute by real player", () => {
            const poolConfig = { init: 5000, playerSettings: { contrib: 0.1, alloc: 90 }, botSettings: { contrib: 0.01, alloc: 80 } };

            it("should return byBots equal 0", () => {
                // arrange

                // act
                const adjustment = consumer.calculatePoolAdjustment({ contributedByMember: true, poolConfig, baseTotalAmount: 5 });
                // assert
                expect(adjustment.byBots).toBe(0);
            });

            it("should return correct byMembers", () => {
                // arrange
                const expected = 5 * poolConfig.playerSettings.contrib;

                // act
                const adjustment = consumer.calculatePoolAdjustment({ contributedByMember: true, poolConfig, baseTotalAmount: 5 });

                // assert
                expect(adjustment.byMembers).toBe(expected);
            });
        });

        describe("when contribute by bot", () => {
            const poolConfig = { init: 5000, playerSettings: { contrib: 0.1, alloc: 90 }, botSettings: { contrib: 0.01, alloc: 80 } };

            it("should return correct byBots ", () => {
                // arrange
                const expected = 5 * poolConfig.botSettings.contrib;

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

        const poolConfigs = { init: 5000, playerSettings: { contrib: 0.1, alloc: 90 }, botSettings: { contrib: 0.01, alloc: 80 } };
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

    describe("hit", () => {
        it("always update jackpot repository", async () => {
            // arrange
            const session = { playerId: 12, currencyGroupId: "617a650628b7a500016388f5" };
            const player = { profile: { name: "A" }, session };
            const bet = { prize: "minor", roundId: gameData.roundId };
            spyOn(consumer, "initializeNewPool");

            // act
            await consumer.hit(player, bet);

            // assert
            expect(jackpotsRepository.findOneAndUpdate).toBeCalledTimes(1);
        });
        //TODO add tests for winnerAdjustment
        it("always init new pool", async () => {
            // arrange
            const session = { playerId: 12, currencyGroupId: "617a650628b7a500016388f5" };
            const player = { profile: { name: "A" }, session };
            const bet = { prize: "minor", roundId: gameData.roundId };
            spyOn(consumer, "initializeNewPool");

            // act
            await consumer.hit(player, bet);

            // assert
            expect(consumer.initializeNewPool).toBeCalledWith(bet.prize, gameData.roundId);
        });

        describe("when have jackpot", () => {
            it("should publish winner", async () => {
                // arrange
                const session = { playerId: 12, currencyGroupId: "617a650628b7a500016388f5" };
                const player = { UID: "uid", profile: { name: "A" }, session };
                const bet = { prize: "minor", roundId: gameData.roundId };
                const winningJackpot = { amount: 12000 };
                const expectedJackpot = { amount: winningJackpot.amount * gameData.gameConfigs.slotsConfig.jackpot.winningRatio, prize: "minor" };
                spyOn(consumer, "initializeNewPool");

                jackpotsRepository.findOneAndUpdate.mockReturnValueOnce(winningJackpot);

                // act
                await consumer.hit(player, bet);

                // assert
                expect(jackpotPublisher.publishWinner).toBeCalledTimes(1);
                expect(jackpotPublisher.publishWinner).toBeCalledWith(player.UID, expectedJackpot);
            });

            it("should return winning jackpot include fee", async () => {
                // arrange
                const session = { playerId: 12, currencyGroupId: "617a650628b7a500016388f5" };
                const player = { UID: "uid", profile: { name: "A" }, session };
                const bet = { prize: "minor", roundId: gameData.roundId };
                const winningJackpot = { amount: 12000 };
                const expectedJackpot = { amount: winningJackpot.amount * gameData.gameConfigs.slotsConfig.jackpot.winningRatio };
                spyOn(consumer, "initializeNewPool");

                jackpotsRepository.findOneAndUpdate.mockReturnValueOnce(winningJackpot);

                // act
                const jackpot = await consumer.hit(player, bet);

                // assert
                expect(jackpot).toStrictEqual(expectedJackpot);
            });
        });

        describe("when NOT have jackpot", () => {
            it("should log error", async () => {
                // arrange
                const session = { playerId: 12, currencyGroupId: "617a650628b7a500016388f5" };
                const player = { profile: { name: "A" }, session };
                const bet = { prize: "minor", roundId: gameData.roundId };
                spyOn(consumer, "initializeNewPool");

                // act
                await consumer.hit(player, bet);

                // assert
                expect(logService.logCritical).toBeCalledTimes(1);
            });

            it("should not publish winner", async () => {
                // arrange
                const session = { playerId: 12, currencyGroupId: "617a650628b7a500016388f5" };
                const player = { profile: { name: "A" }, session };
                const bet = { prize: "minor", roundId: gameData.roundId };
                spyOn(consumer, "initializeNewPool");

                // act
                await consumer.hit(player, bet);

                // assert
                expect(jackpotPublisher.publishWinner).not.toBeCalled();
            });

            it("should return amount 0", async () => {
                // arrange
                const session = { playerId: 12, currencyGroupId: "617a650628b7a500016388f5" };
                const player = { profile: { name: "A" }, session };
                const bet = { prize: "minor", roundId: gameData.roundId };
                const expectedJackpot = { amount: 0 };
                spyOn(consumer, "initializeNewPool");

                // act
                const actual = await consumer.hit(player, bet);

                // assert
                expect(actual).toStrictEqual(expectedJackpot);
            });
        });
    });

    describe("initializeNewPool", () => {
        const prize = "major";

        it("always create new pool", async () => {
            // arrange

            // act
            await consumer.initializeNewPool(prize, gameData.roundId);

            // assert
            expect(jackpotsRepository.create).toBeCalledTimes(1);
        });

        it("always send log", async () => {
            // arrange

            // act
            await consumer.initializeNewPool(prize, gameData.roundId);

            // assert
            expect(logService.log).toBeCalledTimes(1);
        });
    });

    describe("initialize", () => {
        describe("when have pools configuration", () => {
            describe("when have existing pool", () => {
                it("should logCritical", async () => {
                    // arrange
                    jackpotsRepository.countDocuments.mockReturnValue({ exec: jest.fn() });
                    jackpotsRepository.countDocuments().exec.mockReturnValue(2);
                    spyOn(consumer, "initializeNewPool");

                    // act
                    await consumer.initialize();

                    // assert
                    expect(logService.logCritical).toBeCalledTimes(3);
                });
                it("should not init new pool", async () => {
                    // arrange
                    jackpotsRepository.countDocuments.mockReturnValue({ exec: jest.fn() });
                    jackpotsRepository.countDocuments().exec.mockReturnValue(2);
                    spyOn(consumer, "initializeNewPool");

                    // act
                    await consumer.initialize();

                    // assert
                    expect(consumer.initializeNewPool).not.toBeCalled();
                });
            });

            describe("when NO existing pool", () => {
                it("should init new pools", async () => {
                    // arrange
                    jackpotsRepository.countDocuments.mockReturnValue({ exec: jest.fn() });
                    jackpotsRepository.countDocuments().exec.mockReturnValue(0);
                    spyOn(consumer, "initializeNewPool");

                    // act
                    await consumer.initialize();

                    // assert
                    expect(consumer.initializeNewPool).toBeCalledTimes(3);
                });
            });
        });

        describe("when NO pools configuration", () => {
            it("should send log", async () => {
                // arrange
                consumer.gameData.gameConfigs.slotsConfig.jackpot.pools = null;

                // act
                await consumer.initialize();

                // assert
                expect(logService.logCritical).toBeCalledTimes(1);
            });

            it("should not init new pool", async () => {
                // arrange
                consumer.gameData.gameConfigs.slotsConfig.jackpot.pools = null;
                spyOn(consumer, "initializeNewPool");

                // act
                await consumer.initialize();
                // assert
                expect(consumer.initializeNewPool).not.toBeCalled();
            });
        });
    });

    describe("getLatestRoundId", () => {
        it("should return value get from jackpotsRepository", async () => {
            // arrange
            jackpotsRepository.findOne().lean().exec.mockReturnValueOnce({
                createdAt: 1,
            });

            // act
            const roundId = await consumer.getLatestRoundId();

            // assert
            expect(roundId).toBe(1);
        });
    });
});

function initConsumer() {
    return new JackpotConsumer(gameDefinition, gameData, jackpotPublisher, logService, jackpotsRepository, jackpotValidator);
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
                    minor: {
                        init: 5000,
                        playerSettings: { contrib: 0.1, alloc: 90 },
                        botSettings: { contrib: 0.01, alloc: 80 },
                    },
                    major: {
                        init: 25000,
                        playerSettings: { contrib: 0.15, alloc: 9 },
                        botSettings: { contrib: 0.015, alloc: 15 },
                    },
                    grand: {
                        init: 50000,
                        playerSettings: { contrib: 0.25, alloc: 1 },
                        botSettings: { contrib: 0.025, alloc: 5 },
                    },
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
        name: "slot",
        choices: [1, 2, 3, 4, 5],
    });
}
