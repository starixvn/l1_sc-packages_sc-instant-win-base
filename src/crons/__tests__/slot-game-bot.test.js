import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { Core } from "sc-game-base";
import { BaseEventPublishers } from "sc-game-base/src/core";
import { BoardGenerator, PaylineCalculator } from "../../board";
import { BoardCheatingConsumer, HallOfFameConsumer, IdCountersConsumer, JackpotConsumer } from "../../event-consumers";
import SlotGameBot from "../slot-game-bot";

jest.useFakeTimers();

const userInfosRepository = stubMongoose(mongoose.Model);
userInfosRepository.countDocuments.mockReturnValue({ exec: jest.fn() });

const idCountersConsumer = stub(IdCountersConsumer);
const boardCheatingConsumer = stub(BoardCheatingConsumer);
const boardGenerator = stub(BoardGenerator);
const paylineCalculator = stub(PaylineCalculator);
const hallOfFameConsumer = stub(HallOfFameConsumer);
const jackpotConsumer = stub(JackpotConsumer);
const publisher = stub(BaseEventPublishers);

const gameData = {
    gameConfigs: {
        slotsConfig: {
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
            betLevels: [0.1, 0.2, 1, 1.25, 1.5, 2, 3, 5],
        },
    },
    exchangeRates: {
        exId: 1,
    },
};

describe("SlotGameBot", () => {
    let bot;

    beforeEach(() => {
        jest.clearAllMocks();

        bot = new SlotGameBot({
            gameData,
            publisher,
            idCountersConsumer,
            boardCheatingConsumer,
            boardGenerator,
            paylineCalculator,
            hallOfFameConsumer,
            jackpotConsumer,
            userInfosRepository,
            appConfigs: {},
        });
    });
    describe("extends", () => {
        it("should extend Core.Crons.BaseBot", () => {
            // Assert
            expect(bot instanceof Core.Crons.BaseBot);
        });
    });

    describe("reset", () => {
        const testCases = [{ gameConfigs: { botenabled: false } }];
        beforeEach(() => {
            bot.resetAllBotData = jest.fn();
        });

        it.each(testCases)("when bot disabled should empty bot", async (testCase) => {
            // Arrange
            bot.gameData = { gameConfigs: testCase.gameConfigs, players: {} };

            // Act
            await bot.reset();

            // Assert
            expect(bot.bots).toStrictEqual([]);
        });
    });

    describe("resetAllBotData", () => {
        const testCases = [
            {
                slotsConfig: { betLevels: [1, 2, 3, 4], icons: {}, bigWinRatio: 0 },
                expectedOdds: {},
                expectedBigWinRatio: 0,
                expectedBetLevelGroups: [[1], [2], [3], [4]],
            },
            {
                slotsConfig: { betLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], icons: {}, bigWinRatio: 2 },
                expectedOdds: {},
                expectedBigWinRatio: 2,
                expectedBetLevelGroups: [
                    [1, 2, 3, 4],
                    [5, 6],
                    [7, 8],
                    [9, 10],
                ],
            },
        ];
        it.each(testCases)("should reset all info and groupTracks", (testCase) => {
            // Arrange
            bot.gameData = { gameConfigs: { slotsConfig: testCase.slotsConfig } };

            // Act
            bot.resetAllBotData();

            // Assert
            expect(bot.totalNumberOfTickets).toBe(0);
            expect(bot.odds).toStrictEqual(testCase.expectedOdds);
            expect(bot.bigWinRatio).toStrictEqual(testCase.expectedBigWinRatio);
            expect(bot.groupTracks.map((x) => x.betLevels)).toEqual(testCase.expectedBetLevelGroups);
        });
    });

    describe("placeBet", () => {
        const botInfo = { id: 1, profile: { name: "bot" }, selectedBetLevel: 1 };
        const stake = 1;

        beforeEach(() => {
            bot.resetAllBotData();
            bot.adjustGroupTracks = jest.fn();
            bot.getBetAmount = () => stake;
            jest.spyOn(bot.chance, "integer").mockReturnValue(1);
        });

        it("should adjustGroupTracks", async () => {
            // Arrange
            paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }] });

            // Act
            await bot.placeBet(botInfo);

            // Assert
            expect(bot.adjustGroupTracks).toBeCalled();
        });

        it("should generate board for bot", async () => {
            // Arrange
            const { jackpot } = bot.gameData.gameConfigs.slotsConfig;
            paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }] });

            // Act
            await bot.placeBet(botInfo);

            // Assert
            expect(boardGenerator.generateForBots).toHaveBeenCalledWith(
                jackpot.enabled,
                bot.groupTracks.find((x) => x.betLevels.includes(stake)).ratio
            );
        });

        it("should call boardCheatingConsumer", async () => {
            // Arrange
            paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }] });
            boardGenerator.generateForBots.mockReturnValueOnce({});

            // Act
            await bot.placeBet(botInfo);

            // Assert
            expect(boardCheatingConsumer.consume).toHaveBeenCalledWith(botInfo.name, {});
        });

        describe("when jackpot enabled", () => {
            beforeEach(() => {
                bot.gameData.gameConfigs.slotsConfig.jackpot.enabled = true;
            });
            it("should call jackpotConsumer.contribute", async () => {
                // Arrange
                paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }] });

                // Act
                await bot.placeBet(botInfo);

                // Assert
                expect(jackpotConsumer.contribute).toBeCalled();
            });

            describe("when have jackpotPayline", () => {
                it("should pick a prize based on game configs", async () => {
                    // Arrange
                    paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }], jackpotPayline: 0 });

                    // Act
                    await bot.placeBet(botInfo);

                    // Assert
                    const call = jackpotConsumer.hit.mock.calls[0];
                    expect(Object.keys(gameData.gameConfigs.slotsConfig.jackpot.pools)).toContain(call[1].prize);
                });
            });
        });

        describe("when winningAmount exceed bigWin", () => {
            it("should call publisher.publishToAllUsers", async () => {
                // Arrange
                jest.settime
                paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 5 }], jackpotPayline: -1 });

                // Act
                await bot.placeBet(botInfo);
                jest.runAllTimers();
                // Assert
                expect(publisher.publishToAllUsers).toHaveBeenCalled();
            });
        });

        describe("when winningAmount NOT exceed bigWin", () => {
            it("should not call hallOfFameConsumer.add", async () => {
                // Arrange
                paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }], jackpotPayline: -1 });
                bot.bigWinRatio = 50;

                // Act
                await bot.placeBet(botInfo);

                // Assert
                expect(hallOfFameConsumer.add).not.toBeCalled();
            });
        });
    });

    describe("increaseRoundId", () => {
        it("should call idCountersConsumer.consume and increase round id", async () => {
            // Arrange
            bot.gameData = { roundId: 1 };

            // Act
            await bot.increaseRoundId();

            // Assert
            expect(bot.gameData.roundId).toBe(2);
            expect(idCountersConsumer.consume).toBeCalled();
        });
    });

    describe("getBetAmount", () => {
        it("when have underRatioGroups should return first stake of underRatioGroups", () => {
            // Arrange
            bot.gameData = { roundId: 1 };
            const betLevels = [10];
            bot.chance.shuffle = jest.fn();
            bot.chance.shuffle.mockReturnValueOnce([{ betLevels }]);
            bot.totalNumberOfTickets = 10;
            bot.groupTracks = [{}];

            // Act
            const actualValue = bot.getBetAmount();

            // Assert
            expect(betLevels).toContain(actualValue);
        });

        it("when not have underRatioGroups should return randomizeGroup", () => {
            // Arrange
            bot.gameData = { roundId: 1 };
            const betLevels = [20];
            bot.chance.shuffle = jest.fn();
            bot.chance.shuffle.mockReturnValueOnce([]);
            bot.totalNumberOfTickets = 10;
            bot.groupTracks = [{}];
            bot.randomizeGroup = jest.fn();
            bot.randomizeGroup.mockReturnValueOnce({ betLevels });

            // Act
            const actualValue = bot.getBetAmount();

            // Assert
            expect(betLevels).toContain(actualValue);
        });
    });

    describe("randomizeGroup", () => {
        it("should return correct stake", () => {
            // Arrange
            bot.gameData = { roundId: 1 };
            bot.chance = { natural: jest.fn() };
            bot.chance.natural.mockReturnValueOnce(1);
            bot.groupTracks = [{ betLevels: [1] }, { betLevels: [2] }, { betLevels: [3] }];

            // Act
            const actualValue = bot.randomizeGroup();

            // Assert
            expect(actualValue).toEqual({ betLevels: [2] });
        });
    });

    describe("adjustGroupTracks", () => {
        const testCases = [
            {
                betAmount: 20,
                expectedgroupTracks: [
                    { betLevels: [10], numberOfTickets: 2 },
                    { betLevels: [20], numberOfTickets: 4 },
                    { betLevels: [30], numberOfTickets: 4 },
                ],
            },
            {
                betAmount: 30,
                expectedgroupTracks: [
                    { betLevels: [10], numberOfTickets: 2 },
                    { betLevels: [20], numberOfTickets: 3 },
                    { betLevels: [30], numberOfTickets: 5 },
                ],
            },
        ];

        it.each(testCases)("should update numberOfTickets of correct stake", (testCase) => {
            // Arrange
            bot.gameData = { roundId: 1 };
            bot.chance = { natural: jest.fn() };
            bot.chance.natural.mockReturnValueOnce(1);
            bot.groupTracks = [
                { betLevels: [10], numberOfTickets: 2 },
                { betLevels: [20], numberOfTickets: 3 },
                { betLevels: [30], numberOfTickets: 4 },
            ];

            // Act
            bot.adjustGroupTracks(testCase.betAmount);

            // Assert
            expect(bot.groupTracks).toStrictEqual(testCase.expectedgroupTracks);
        });
    });
});
