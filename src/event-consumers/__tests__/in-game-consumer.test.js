import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { BaseEventPublishers, RoundQuery } from "sc-game-base/src/core";

import { FreeSpinsConsumer, InGameConsumer } from "../";
import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";
import JackpotValidator from "../../validators/jackpot-validator";

/** @type {mongoose.Model}*/
const userInfosRepository = stubMongoose(mongoose.Model);
/** @type {mongoose.Model}*/
const jackpotsRepository = stubMongoose(mongoose.Model);
const currencyGroupGamesRepository = stubMongoose(mongoose.Model);
const getBalance = jest.fn();

describe("IngameConsumer", () => {
    const gameData = stubGameData();
    const definition = stubGameDefinition();
    const publisher = stub(BaseEventPublishers);
    const roundQuery = stub(RoundQuery);
    const jackpotValidator = stub(JackpotValidator);
    const freeSpinsConsumer = stub(FreeSpinsConsumer);

    let consumer;

    beforeEach(() => {
        consumer = new InGameConsumer({
            definition,
            gameData,
            roundQuery,
            publisher,
            freeSpinsConsumer,
            getBalance,
            userInfosRepository,
            jackpotsRepository,
            currencyGroupGamesRepository,
            jackpotValidator,
        });
    });
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("getPools", () => {
        it("should get pools from jackpot repository", async () => {
            // arrange
            const expectPools = [
                { pool: 1, amount: 1000, prize: "minor" },
                { pool: 5, amount: 10000, prize: "major" },
                { pool: 10, amount: 100000, prize: "grand" },
            ];

            jackpotsRepository.find().lean().exec.mockReturnValueOnce(expectPools);

            // act
            const pools = await consumer.getPools();

            // assert
            expect(pools).toStrictEqual(expectPools);
        });
    });

    describe("buildPayload", () => {
        describe("when player cannot access jackpot", () => {
            it(" should not call get jackpot pools", async () => {
                // arrange
                jackpotValidator.canAccessJackpot.mockReturnValueOnce(false);
                consumer.gameData.gameConfigs.slotsConfig.jackpot.enabled = false;
                const spy = jest.spyOn(consumer, "getPools");

                // act
                await consumer.buildPayload({ session: { currencyGroupId: "617a650628b7a500016388f5" } });

                // assert
                expect(spy).not.toHaveBeenCalled();
                consumer.gameData.gameConfigs.slotsConfig.jackpot.enabled = true;
            });
        });

        describe("when player able to access jackpot", () => {
            it("should contains jackpot pools", async () => {
                // arrange
                const expectPools = [{ pool: 1, amount: 1000 }];
                jackpotValidator.canAccessJackpot.mockReturnValueOnce(true);

                jackpotsRepository.find().lean().exec.mockReturnValueOnce(expectPools);
                const player = { session: { currencyGroupId: "617a650628b7a500016388f5", currencyCode: "AUD", multiplier: 1000 } };

                // act
                const payload = await consumer.buildPayload(player);

                // assert
                expect(payload.jackpotPools).not.toBeNull();
                expect(payload.jackpotPools).toStrictEqual(expectPools);
            });
        });

        it("always contains exchange rate", async () => {
            // arrange
            const player = { session: { currencyGroupId: "617a650628b7a500016388f5", currencyCode: "AUD", multiplier: 1000 } };

            // act
            const { user } = await consumer.buildPayload(player);

            // assert
            expect(user.rate).not.toBeNull();
            expect(user.rate).not.toBeUndefined();
            expect(user.multiplier).not.toBeNull();
            expect(user.multiplier).not.toBeUndefined();
        });

        it("always contains disableJackpotGames from session", async () => {
            // arrange
            const player = { session: { disableJackpotGames: true } };

            // act
            const { user } = await consumer.buildPayload(player);

            // assert
            expect(user.disableJackpotGames).not.toBeUndefined();
            expect(user.disableJackpotGames).toBe(player.session.disableJackpotGames);
        });

        it("always contains free spins", async () => {
            // arrange
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

    describe("getAvailableFreeSpins", () => {
        it("always return NOT NULL", () => {
            // arrange

            // act
            const freeSpins = consumer.getAvailableFreeSpins({ session: {} });

            // assert
            expect(freeSpins).not.toBeNull();
        });

        it("always return approriate format", () => {
            // arrange
            const expectedFreeSpins = {
                total: 0,
                bet: 0,
                paylines: [],
            };
            freeSpinsConsumer.getTotalAvaiableFreeSpins.mockReturnValueOnce(0);

            // act
            const freeSpins = consumer.getAvailableFreeSpins({ session: {} });

            // assert
            expect(freeSpins).toStrictEqual(expectedFreeSpins);
        });

        describe("when have free spins", () => {
            it("should return total, bet and paylines", () => {
                // arrange
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
                const freeSpins = consumer.getAvailableFreeSpins({ session: {} });

                // assert
                expect(freeSpins).toStrictEqual(expectedFreeSpins);
            });
        });
    });

    describe("getSlotGameConfig", () => {
        it("always return approriate format", () => {
            // arrange
            const player = { session: { currencyGroupId: "617a650628b7a500016388f5", currencyCode: "AUD", multiplier: 1000 } };
            const expected = {
                betLevels: [2.5, 25, 125],
                defaultBetLevel: 125,
                odds: [],
                jackpot: {
                    winningRatio: 0.98,
                    pools: [
                        { pool: "minor", contribute: 0.1 },
                        { pool: "major", contribute: 0.15 },
                        { pool: "grand", contribute: 0.25 },
                    ],
                },
            };

            // act
            const slotConfig = consumer.getSlotGameConfig(player, true);

            // assert
            expect(slotConfig).toStrictEqual(expected);
        });

        it("should round betLevels and defaultBetLevel to 4 decimal places", () => {
            // arrange
            const gameData = stubGameData();
            gameData.currencyGroupGames = [
                {
                    groupId: "617a650628b7a500016388f5",
                    betLevels: [0.0001, 0.0002, 0.0003, 0.0004, 0.004, 0.006, 0.01, 0.02],
                    defaultBetLevel: 0.0001,
                },
            ];
            const consumer = new InGameConsumer({
                definition,
                gameData,
                roundQuery,
                publisher,
                freeSpinsConsumer,
                getBalance,
                userInfosRepository,
                jackpotsRepository,
                currencyGroupGamesRepository,
                jackpotValidator,
            });
            const player = { session: { currencyGroupId: "617a650628b7a500016388f5", currencyCode: "AUD", multiplier: 1000 } };

            // act
            const slotConfig = consumer.getSlotGameConfig(player, true);

            // assert
            const expectedBetLevels = [0.0025, 0.005, 0.0075, 0.01, 0.1, 0.15, 0.25, 0.5];
            const expectedDefaultBetLevel = 0.0025;
            expect(slotConfig.betLevels).toEqual(expectedBetLevels);
            expect(slotConfig.defaultBetLevel).toBe(expectedDefaultBetLevel);
        });
    });
});

function stubGameData() {
    const gameData = new SlotGameData();

    gameData.remainingTime = 20;
    gameData.gameConfigs = {
        enabled: true,
        minbet: 1,
        maxbet: 1000,
        slotsConfig: {
            betLevels: [0.1, 1, 5],
            icons: [],
            jackpot: {
                winningRatio: 0.98,
                enabled: true,
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
            },
        },
    };

    gameData.currencyGroupGames = [{ groupId: "617a650628b7a500016388f5", betLevels: [0.1, 1, 5], defaultBetLevel: 5 }];
    gameData.exchangeRates = { code: { AUD: 1 } };

    return gameData;
}

function stubGameDefinition() {
    return new SlotGameDefinition({
        id: 1,
        choices: [1, 2, 3, 4, 5],
    });
}
