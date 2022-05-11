import SlotGameBot from "../slot-game-bot";
import { Core } from "sc-game-base";
import mongoose from "mongoose";
import { stub, stubMongoose } from "jest-micro-auto-stub";
import { IdCountersConsumer, BoardCheatingConsumer, HallOfFameConsumer, JackpotConsumer } from "../../event-consumers";
import { BoardGenerator, PaylineCalculator } from "../../board";

const userInfosRepository = stubMongoose(mongoose.Model);
userInfosRepository.countDocuments.mockReturnValue({ exec: jest.fn() });

const idCountersConsumer = stub(IdCountersConsumer);
const boardCheatingConsumer = stub(BoardCheatingConsumer);
const boardGenerator = stub(BoardGenerator);
const paylineCalculator = stub(PaylineCalculator);
const hallOfFameConsumer = stub(HallOfFameConsumer);
const jackpotConsumer = stub(JackpotConsumer);

const gameData = {
    gameConfigs: {
        slotsConfig: {
            jackpot: {},
            stakeLevels: [
                { stake: 1, botRatio: 40 },
                { stake: 5, botRatio: 40 },
                { stake: 10, botRatio: 20 },
            ],
        },
    },
};

describe("SlotGameBot", () => {
    let bot;

    beforeEach(() => {
        jest.clearAllMocks();

        bot = new SlotGameBot({
            gameData,
            idCountersConsumer,
            boardCheatingConsumer,
            boardGenerator,
            paylineCalculator,
            hallOfFameConsumer,
            jackpotConsumer,
            userInfosRepository,
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

        it.each(testCases)("when bot disabled should empty bot", async (testCase) => {
            // Arrange
            bot.gameData = { gameConfigs: testCase.gameConfigs };

            // Act
            await bot.reset();

            // Assert
            expect(bot.bots).toStrictEqual([]);
        });

        it("when bot enabled should have bot list", async () => {
            // Arrange
            bot.gameData = { gameConfigs: { botenabled: true, maxbot: 10 } };
            userInfosRepository
                .find()
                .lean()
                .exec.mockReturnValueOnce([{ id: 1 }]);
            userInfosRepository.countDocuments().exec.mockReturnValueOnce(2);

            // Act
            await bot.reset();

            // Assert
            expect(bot.bots.length).toBe(1);
        });
    });

    describe("standardizeBots", () => {
        it("should return correct value", () => {
            // Arrange
            const botInfo = [{ id: 1, name: "bot1" }];
            const expectedValue = [
                {
                    UID: 1,
                    profile: {
                        name: "bot1",
                    },
                },
            ];

            // Act
            const ActualValue = bot.standardizeBots(botInfo);

            // Assert
            expect(ActualValue).toStrictEqual(expectedValue);
        });
    });

    describe("resetAllBotData", () => {
        const testCases = [
            { slotsConfig: undefined, expectedOdds: {}, expectedBigWinRatio: 3 },
            { slotsConfig: { stakeLevels: [], icons: {}, bigWinRatio: 0 }, expectedOdds: {}, expectedBigWinRatio: 0 },
            { slotsConfig: { stakeLevels: [{ id: 1 }], icons: {}, bigWinRatio: 0 }, expectedOdds: {}, expectedBigWinRatio: 0 },
            { slotsConfig: { stakeLevels: [{ id: 1 }], icons: {}, bigWinRatio: 2 }, expectedOdds: {}, expectedBigWinRatio: 2 },
        ];
        it.each(testCases)("should reset all info", (testCase) => {
            // Arrange
            bot.gameData = { gameConfigs: { slotsConfig: testCase.slotsConfig } };

            // Act
            bot.resetAllBotData();

            // Assert
            expect(bot.totalNumberOfTickets).toBe(0);
            expect(bot.odds).toStrictEqual(testCase.expectedOdds);
            expect(bot.bigWinRatio).toStrictEqual(testCase.expectedBigWinRatio);
        });
    });

    describe("placeBet", () => {
        const botInfo = { id: 1, profile: { name: "bot" } };
        const stake = 1;

        beforeEach(() => {
            bot.gameData = {
                gameConfigs: {
                    slotsConfig: {
                        jackpot: { enabled: false },
                        stakeLevels: [
                            { stake: 1, botRatio: 40 },
                            { stake: 5, botRatio: 40 },
                            { stake: 10, botRatio: 20 },
                        ],
                    },
                },
            };

            bot.resetAllBotData();
            bot.adjustStakeLevelsTracks = jest.fn();
            bot.getBetAmount = () => stake;
        });

        it("should adjustStakeLevelsTracks", async () => {
            // Arrange
            paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }] });

            // Act
            await bot.placeBet(botInfo);

            // Assert
            expect(bot.adjustStakeLevelsTracks).toBeCalled();
        });

        it("should generate board for bot", async () => {
            // Arrange
            const { jackpot } = bot.gameData.gameConfigs.slotsConfig;
            paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }] });

            // Act
            await bot.placeBet(botInfo);

            // Assert
            expect(boardGenerator.generateForBots).toHaveBeenCalledWith(jackpot.enabled, bot.stakeLevelsTracks[stake].ratio);
        });

        it("should call boardCheatingConsumer", async () => {
            // Arrange
            paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }] });
            boardGenerator.generateForBots.mockReturnValueOnce({});

            // Act
            await bot.placeBet(botInfo);

            // Assert
            expect(boardCheatingConsumer.consume).toHaveBeenCalledWith(botInfo.profile.name, {});
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
                it("should call jackpotConsumer.hit", async () => {
                    // Arrange
                    paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }], jackpotPayline: 0 });

                    // Act
                    await bot.placeBet(botInfo);

                    // Assert
                    expect(jackpotConsumer.hit).toBeCalled();
                });
            });
        });

        describe("when winningAmount exceed bigWin", () => {
            it("should call hallOfFameConsumer.add", async () => {
                // Arrange
                paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 5 }], jackpotPayline: 0 });

                // Act
                await bot.placeBet(botInfo);

                // Assert
                expect(hallOfFameConsumer.add).toBeCalled();
            });
        });

        describe("when winningAmount NOT exceed bigWin", () => {
            it("should not call hallOfFameConsumer.add", async () => {
                // Arrange
                paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }], jackpotPayline: 0 });
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

    describe("randomizePaylines", () => {
        it("should call chance.pickset", async () => {
            // Arrange
            bot.gameData = { roundId: 1 };
            bot.chance = { pickset: jest.fn(), natural: jest.fn() };

            // Act
            await bot.randomizePaylines();

            // Assert
            expect(bot.chance.pickset).toBeCalled();
        });
    });

    describe("getBetAmount", () => {
        it("when have underRatioStakeLevels should return first stake of underRatioStakeLevels", () => {
            // Arrange
            bot.gameData = { roundId: 1 };
            bot.chance = { shuffle: jest.fn() };
            bot.chance.shuffle.mockReturnValueOnce([{ stake: 10 }]);
            bot.totalNumberOfTickets = 10;
            bot.stakeLevelsTracks = [{}];

            // Act
            const ActualValue = bot.getBetAmount();

            // Assert
            expect(ActualValue).toBe(10);
        });

        it("when not have underRatioStakeLevels should return randomizeStakeLevel", () => {
            // Arrange
            bot.gameData = { roundId: 1 };
            bot.chance = { shuffle: jest.fn() };
            bot.chance.shuffle.mockReturnValueOnce([]);
            bot.totalNumberOfTickets = 10;
            bot.stakeLevelsTracks = [{}];
            bot.randomizeStakeLevel = jest.fn();
            bot.randomizeStakeLevel.mockReturnValueOnce(20);

            // Act
            const ActualValue = bot.getBetAmount();

            // Assert
            expect(ActualValue).toBe(20);
        });
    });

    describe("randomizeStakeLevel", () => {
        it("should return correct stake", () => {
            // Arrange
            bot.gameData = { roundId: 1 };
            bot.chance = { natural: jest.fn() };
            bot.chance.natural.mockReturnValueOnce(1);
            bot.stakeLevelsTracks = [{ stake: 10 }, { stake: 20 }, { stake: 30 }];

            // Act
            const ActualValue = bot.randomizeStakeLevel();

            // Assert
            expect(ActualValue).toBe(20);
        });
    });

    describe("adjustStakeLevelsTracks", () => {
        const testCases = [
            {
                betAmount: 20,
                expectedStakeLevelsTracks: [
                    { stake: 10, numberOfTickets: 2 },
                    { stake: 20, numberOfTickets: 4 },
                    { stake: 30, numberOfTickets: 4 },
                ],
            },
            {
                betAmount: 40,
                expectedStakeLevelsTracks: [
                    { stake: 10, numberOfTickets: 2 },
                    { stake: 20, numberOfTickets: 3 },
                    { stake: 30, numberOfTickets: 4 },
                ],
            },
        ];

        it.each(testCases)("should update numberOfTickets of correct stake", (testCase) => {
            // Arrange
            bot.gameData = { roundId: 1 };
            bot.chance = { natural: jest.fn() };
            bot.chance.natural.mockReturnValueOnce(1);
            bot.stakeLevelsTracks = [
                { stake: 10, numberOfTickets: 2 },
                { stake: 20, numberOfTickets: 3 },
                { stake: 30, numberOfTickets: 4 },
            ];

            // Act
            bot.adjustStakeLevelsTracks(testCase.betAmount);

            // Assert
            expect(bot.stakeLevelsTracks).toStrictEqual(testCase.expectedStakeLevelsTracks);
        });
    });
});
