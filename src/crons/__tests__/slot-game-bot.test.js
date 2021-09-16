import SlotGameBot from "../slot-game-bot";
import { Core } from "sc-game-base";
import mongoose from "mongoose";
import { stubMongooseModelStupidly } from "jest-micro-auto-stub";

const userInfosRepository = stubMongooseModelStupidly(mongoose.Model);
userInfosRepository.countDocuments.mockReturnValue({ exec: jest.fn() });

describe("slot-game-bot", () => {
    describe("extends", () => {
        it("should extend Core.Crons.BaseBot", () => {
            // act
            const bot = new SlotGameBot({});

            // assert
            expect(bot instanceof Core.Crons.BaseBot);
        });
    });

    describe("reset", () => {
        const testCases = [
            { gameConfigs: { botenabled: false } },
            // { gameConfigs: undefined },
        ];

        it.each(testCases)("when bot disabled should empty bot", async (testCase) => {
            // arrange
            const gameData = { gameConfigs: testCase.gameConfigs };
            const bot = new SlotGameBot({ gameData });

            // act
            await bot.reset();

            // assert
            expect(bot.bots).toStrictEqual([]);
        });

        it("when bot enabled should have bot list", async () => {
            // arrange
            const gameData = { gameConfigs: { botenabled: true, maxbot: 10 } };
            userInfosRepository
                .find()
                .lean()
                .exec.mockReturnValueOnce([{ id: 1 }]);
            userInfosRepository.countDocuments().exec.mockReturnValueOnce(2);

            const bot = new SlotGameBot({ gameData, userInfosRepository });

            // act
            await bot.reset();

            // assert
            expect(bot.bots.length).toBe(1);
        });
    });

    describe("standardizeBots", () => {
        it("should return correct value", () => {
            // arrange
            const bot = new SlotGameBot({});
            const botInfo = [{ id: 1, name: "bot1" }];
            const expectedValue = [
                {
                    UID: 1,
                    profile: {
                        name: "bot1",
                    },
                },
            ];

            // act
            const actualValue = bot.standardizeBots(botInfo);

            // assert
            expect(actualValue).toStrictEqual(expectedValue);
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
            // arrange
            const gameData = { gameConfigs: { slotsConfig: testCase.slotsConfig } };

            const bot = new SlotGameBot({ gameData });

            // act
            bot.resetAllBotData();

            // assert
            expect(bot.totalNumberOfTickets).toBe(0);
            expect(bot.odds).toStrictEqual(testCase.expectedOdds);
            expect(bot.bigWinRatio).toStrictEqual(testCase.expectedBigWinRatio);
        });
    });

    describe("placeBet", () => {
        const idCountersConsumer = { consume: jest.fn() };
        const boardCheatingConsumer = { consume: jest.fn() };
        const boardGenerator = { generateForBots: jest.fn() };
        const paylineCalculator = { calculate: jest.fn() };
        const hallOfFameConsumer = { add: jest.fn() };
        const jackpotConsumer = { contribute: jest.fn(), hit: jest.fn() };

        it("should adjustStakeLevelsTracks", async () => {
            // arrange
            paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }] });
            const gameData = { gameConfigs: { slotsConfig: { jackpot: {} } } };

            const bot = new SlotGameBot({
                gameData,
                idCountersConsumer,
                boardCheatingConsumer,
                boardGenerator,
                paylineCalculator,
                hallOfFameConsumer,
            });
            bot.adjustStakeLevelsTracks = jest.fn();
            bot.getBetAmount = () => 1;
            const botInfo = { id: 1, profile: {} };

            // act
            await bot.placeBet(botInfo);

            // assert
            expect(bot.adjustStakeLevelsTracks).toBeCalled();
        });

        it("when jackpot enabled should call jackpotConsumer.contribute", async () => {
            // arrange
            paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }] });
            const gameData = { gameConfigs: { slotsConfig: { jackpot: { enabled: true } } } };

            const bot = new SlotGameBot({
                gameData,
                idCountersConsumer,
                boardCheatingConsumer,
                boardGenerator,
                paylineCalculator,
                hallOfFameConsumer,
                jackpotConsumer,
            });
            bot.adjustStakeLevelsTracks = jest.fn();
            bot.getBetAmount = () => 1;
            const botInfo = { id: 1, profile: {} };

            // act
            await bot.placeBet(botInfo);

            // assert
            expect(jackpotConsumer.contribute).toBeCalled();
        });

        it("when jackpot enabled and have jackpotPayline should call jackpotConsumer.hit", async () => {
            // arrange
            paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }], jackpotPayline: 0 });
            const gameData = { gameConfigs: { slotsConfig: { jackpot: { enabled: true } } } };

            const bot = new SlotGameBot({
                gameData,
                idCountersConsumer,
                boardCheatingConsumer,
                boardGenerator,
                paylineCalculator,
                hallOfFameConsumer,
                jackpotConsumer,
            });
            bot.adjustStakeLevelsTracks = jest.fn();
            bot.getBetAmount = () => 1;
            const botInfo = { id: 1, profile: {} };

            // act
            await bot.placeBet(botInfo);

            // assert
            expect(jackpotConsumer.hit).toBeCalled();
        });

        it("when winningAmount exceed bigWin should call hallOfFameConsumer.add", async () => {
            // arrange
            paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }], jackpotPayline: 0 });
            const gameData = { gameConfigs: { slotsConfig: { jackpot: { enabled: true } } } };

            const bot = new SlotGameBot({
                gameData,
                idCountersConsumer,
                boardCheatingConsumer,
                boardGenerator,
                paylineCalculator,
                hallOfFameConsumer,
                jackpotConsumer,
            });
            bot.adjustStakeLevelsTracks = jest.fn();
            bot.getBetAmount = () => 1;
            const botInfo = { id: 1, profile: {} };

            // act
            await bot.placeBet(botInfo);

            // assert
            expect(hallOfFameConsumer.add).toBeCalled();
        });

        it("when winningAmount not exceed bigWin should call hallOfFameConsumer.add", async () => {
            // arrange
            paylineCalculator.calculate.mockReturnValueOnce({ paylines: [{ odds: 1 }], jackpotPayline: 0 });
            const gameData = { gameConfigs: { slotsConfig: { jackpot: { enabled: true } } } };
            const h = { add: jest.fn() };

            const bot = new SlotGameBot({
                gameData,
                idCountersConsumer,
                boardCheatingConsumer,
                boardGenerator,
                paylineCalculator,
                h,
                jackpotConsumer,
            });
            bot.adjustStakeLevelsTracks = jest.fn();
            bot.getBetAmount = () => 1;
            bot.bigWinRatio = 50;
            const botInfo = { id: 1, profile: {} };

            // act
            await bot.placeBet(botInfo);

            // assert
            expect(h.add).not.toBeCalled();
        });
    });

    describe("increaseRoundId", () => {
        it("should call idCountersConsumer.consume and increase round id", async () => {
            // arrange
            const gameData = { roundId: 1 };
            const idCountersConsumer = { consume: jest.fn() };
            const bot = new SlotGameBot({ gameData, idCountersConsumer });

            // act
            await bot.increaseRoundId();

            // assert
            expect(bot.gameData.roundId).toBe(2);
            expect(idCountersConsumer.consume).toBeCalled();
        });
    });

    describe("randomizePaylines", () => {
        it("should call chance.pickset", async () => {
            // arrange
            const gameData = { roundId: 1 };
            const boardGenerator = { numberOfPaylines: 3 };
            const bot = new SlotGameBot({ gameData, boardGenerator });
            bot.chance = { pickset: jest.fn(), natural: jest.fn() };

            // act
            await bot.randomizePaylines();

            // assert
            expect(bot.chance.pickset).toBeCalled();
        });
    });

    describe("getBetAmount", () => {
        it("when have underRatioStakeLevels should return first stake of underRatioStakeLevels", () => {
            // arrange
            const gameData = { roundId: 1 };
            const bot = new SlotGameBot({ gameData });
            bot.chance = { shuffle: jest.fn() };
            bot.chance.shuffle.mockReturnValueOnce([{ stake: 10 }]);
            bot.totalNumberOfTickets = 10;
            bot.stakeLevelsTracks = [{}];

            // act
            const actualValue = bot.getBetAmount();

            // assert
            expect(actualValue).toBe(10);
        });

        it("when not have underRatioStakeLevels should return randomizeStakeLevel", () => {
            // arrange
            const gameData = { roundId: 1 };
            const bot = new SlotGameBot({ gameData });
            bot.chance = { shuffle: jest.fn() };
            bot.chance.shuffle.mockReturnValueOnce([]);
            bot.totalNumberOfTickets = 10;
            bot.stakeLevelsTracks = [{}];
            bot.randomizeStakeLevel = jest.fn();
            bot.randomizeStakeLevel.mockReturnValueOnce(20);

            // act
            const actualValue = bot.getBetAmount();

            // assert
            expect(actualValue).toBe(20);
        });
    });

    describe("randomizeStakeLevel", () => {
        it("should return correct stake", () => {
            // arrange
            const gameData = { roundId: 1 };
            const bot = new SlotGameBot({ gameData });
            bot.chance = { natural: jest.fn() };
            bot.chance.natural.mockReturnValueOnce(1);
            bot.stakeLevelsTracks = [{ stake: 10 }, { stake: 20 }, { stake: 30 }];

            // act
            const actualValue = bot.randomizeStakeLevel();

            // assert
            expect(actualValue).toBe(20);
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
            // arrange
            const gameData = { roundId: 1 };
            const bot = new SlotGameBot({ gameData });
            bot.chance = { natural: jest.fn() };
            bot.chance.natural.mockReturnValueOnce(1);
            bot.stakeLevelsTracks = [
                { stake: 10, numberOfTickets: 2 },
                { stake: 20, numberOfTickets: 3 },
                { stake: 30, numberOfTickets: 4 },
            ];

            // act
            bot.adjustStakeLevelsTracks(testCase.betAmount);

            // assert
            expect(bot.stakeLevelsTracks).toStrictEqual(testCase.expectedStakeLevelsTracks);
        });
    });
});
