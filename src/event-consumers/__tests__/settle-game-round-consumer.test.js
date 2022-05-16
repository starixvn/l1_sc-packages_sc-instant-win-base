import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { Core } from "sc-game-base";
import { RoundResultPublisher, UserBetResultPublisher } from "sc-game-base/src/core/event-publishers";

import { BoardCheatingConsumer, FreeSpinsConsumer, HallOfFameConsumer, JackpotConsumer, SettleGameRoundConsumer } from "..";
import odds from "../../../tests/odds";
import { BoardGenerator, BonusBoardGenerator, PaylineCalculator } from "../../board";
import { JackpotPublisher } from "../../event-publishers";
import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";

beforeEach(() => {
    jest.clearAllMocks();
});

describe("SettleGameRoundConsumer", () => {
    it("instance should inherit Core.SettleGameRoundConsumer", () => {
        // act
        const consumer = new SettleGameRoundConsumer(initDependencies());

        // assert
        expect(consumer instanceof Core.BaseEventConsumers.SettleGameRoundConsumer);
    });
});

describe("autoSettleRound", () => {
    it("always call queryBets and settleBets", async () => {
        // arrange
        const consumer = new SettleGameRoundConsumer(initDependencies());
        const player = stubPlayer();
        consumer.gameData.ingame[player.profile.name] = { finish: stubFinish(), bonusChests: [] };
        spyOn(consumer, "queryBets");
        spyOn(consumer, "settleBets");

        // act
        await consumer.autoSettleRound(player, 1);

        // assert
        expect(consumer.queryBets).toBeCalledWith(1);
        expect(consumer.settleBets).toBeCalled();
    });

    it("should settleBets with picked bonus", async () => {
        // arrange
        const consumer = new SettleGameRoundConsumer(initDependencies());
        const player = stubPlayer();
        const bonusChests = [
            { amount: 1, picked: false },
            { amount: 2, picked: true },
        ];
        const finish = stubFinish();
        consumer.gameData.ingame[player.profile.name] = { finish, bonusChests };
        spyOn(consumer, "queryBets").and.returnValue({ amount: 5 });
        spyOn(consumer, "settleBets");

        // act
        await consumer.autoSettleRound(player, 1);

        // assert
        expect(consumer.settleBets).toBeCalledWith(player, finish, { amount: 5 }, [{ amount: 2, picked: true }]);
    });

    it("when not finish should not call settleBets", async () => {
        // arrange
        const consumer = new SettleGameRoundConsumer(initDependencies());
        const player = { profile: { name: "player1" } };
        consumer.gameData.ingame["player1"] = { finish: false };
        spyOn(consumer, "settleBets");

        // act
        await consumer.autoSettleRound(player, 1);

        // assert
        expect(consumer.settleBets).not.toBeCalled();
    });
});

describe("settleRound", () => {
    it("always call queryBets", async () => {
        // arrange
        const consumer = new SettleGameRoundConsumer(initDependencies());
        const player = stubPlayer();
        consumer.gameData.ingame[player.profile.name] = { finish: stubFinish(), bonusChests: [] };
        spyOn(consumer, "queryBets");
        spyOn(consumer, "settleBets");

        // act
        await consumer.settleRound(player, 1);

        // assert
        expect(consumer.queryBets).toBeCalledWith(1);
    });

    it("should settleBets when have bet and no bonus", async () => {
        // arrange
        const consumer = new SettleGameRoundConsumer(initDependencies());
        const player = stubPlayer();
        const bet = { bet: 1, paylines: [1, 2, 3], name: player.profile.name };
        const board = [1, 2, 2, 1, 4, 4, 1, 9, 3, 4, 1, 2, 7, 2, 2];
        consumer.boardGenerator.generate.mockReturnValueOnce(board);
        consumer.boardCheatingConsumer.consume.mockReturnValueOnce(board);
        spyOn(consumer, "queryBets").and.returnValue(bet);
        spyOn(consumer, "settleBets");

        // act
        await consumer.settleRound(player, 1);

        // assert
        expect(consumer.settleBets).toBeCalled();
    });

    it("when have bet and bonus should processBonus", async () => {
        // arrange
        const consumer = new SettleGameRoundConsumer(initDependencies());
        const player = stubPlayer();
        const bet = { bet: 1, paylines: [1, 2, 3], name: player.profile.name };
        const board = [1, 2, 2, 1, 4, 4, 1, 9, 3, 4, 1, 2, 7, 2, 2];
        consumer.boardGenerator.generate.mockReturnValueOnce(board);
        consumer.boardCheatingConsumer.consume.mockReturnValueOnce(board);
        spyOn(consumer, "queryBets").and.returnValue(bet);
        spyOn(consumer, "generateRoundResult").and.returnValue({ settlementResult: { bonus: { odds: 2 } } });
        spyOn(consumer, "processBonus");

        // act
        await consumer.settleRound(player, 1);

        // assert
        expect(consumer.processBonus).toBeCalled();
    });

    it("when enable jackpot and  not freeSpin and player has enable jackpot should call jackpotConsumer.contribute", async () => {
        // arrange
        const consumer = new SettleGameRoundConsumer(initDependencies());
        const player = stubPlayer();
        const bet = { bet: 1, paylines: [1, 2, 3], name: player.profile.name };
        const board = [1, 2, 2, 1, 4, 4, 1, 9, 3, 4, 1, 2, 7, 2, 2];
        consumer.boardGenerator.generate.mockReturnValueOnce(board);
        consumer.boardCheatingConsumer.consume.mockReturnValueOnce(board);
        consumer.gameData.gameConfigs.slotsConfig.jackpot.enabled = true;
        spyOn(consumer, "queryBets").and.returnValue(bet);
        spyOn(consumer, "isUserEnableJackpot").and.returnValue(true);
        spyOn(consumer, "settleBets");

        // act
        await consumer.settleRound(player, 1);

        // assert
        expect(consumer.jackpotConsumer.contribute).toBeCalled();
    });

    const testCases = [
        { userEnableJackpot: false },
        { userEnableJackpot: true, freeSpin: true },
        { userEnableJackpot: true, freeSpin: false, enableJackpot: false },
    ];

    it.each(testCases)(
        "when [disable jackpot or freeSpin or player has disable jackpot] should not call jackpotConsumer.contribute",
        async (testCase) => {
            // arrange
            const consumer = new SettleGameRoundConsumer(initDependencies());
            const player = stubPlayer();
            const bet = { bet: 1, paylines: [1, 2, 3], name: player.profile.name, freeSpin: testCase.freeSpin };
            const board = [1, 2, 2, 1, 4, 4, 1, 9, 3, 4, 1, 2, 7, 2, 2];
            consumer.boardGenerator.generate.mockReturnValueOnce(board);
            consumer.boardCheatingConsumer.consume.mockReturnValueOnce(board);
            consumer.gameData.gameConfigs.slotsConfig.jackpot.enabled = testCase.enableJackpot;
            spyOn(consumer, "queryBets").and.returnValue(bet);
            spyOn(consumer, "isUserEnableJackpot").and.returnValue(testCase.userEnableJackpot);
            spyOn(consumer, "settleBets");

            // act
            await consumer.settleRound(player, 1);

            // assert
            expect(consumer.jackpotConsumer.contribute).not.toBeCalled();
        }
    );
});

describe("settle-game-round-consumer", () => {
    describe("collectBonusResult", () => {
        it("should return correct value", () => {
            // arrange
            const consumer = new SettleGameRoundConsumer(initDependencies());
            const result = 3;
            const settlementResult = { bonus: { odds: 2 } };
            const roundId = 1;
            const expectedValue = {
                bonuses: {
                    roundId: 1,
                    bonus: 2,
                    result: 3,
                },
            };

            // act
            const actualValue = consumer.collectBonusResult({ result, settlementResult, roundId });

            // assert
            expect(actualValue).toStrictEqual(expectedValue);
        });
    });

    describe("collectRoundSettlementResult", () => {
        // arrange
        const dependencies = initDependencies();
        dependencies.boardGenerator.definition = { specialSymbols: { bonus: 1, freeSpins: 2, jackpot: 3 } };
        const consumer = new SettleGameRoundConsumer(dependencies);
        const winningPaylines = [
            {
                payline: 1,
                symbol: 2,
                count: 2,
            },
        ];

        const bonus = { odds: 2 };
        const freeSpins = { odds: 3 };

        it("when have jackpot should return correct value", () => {
            // arrange
            const jackpot = { jackpotId: 1 };
            const expectedValue = {
                winningLines: [
                    {
                        payline: 1,
                        symbol: 2,
                        count: 2,
                        positions: [0, 3, 6, 9, 12],
                    },
                ],
                bonus: { symbol: 1, count: 2 },
                freeSpins: { symbol: 2, count: 3 },
                jackpot: { jackpotId: 1, symbol: 3, positions: undefined },
            };

            // act
            const actualValue = consumer.collectRoundSettlementResult({ winningPaylines, bonus, freeSpins, jackpot });

            // assert
            expect(actualValue).toStrictEqual(expectedValue);
        });

        it("when not have jackpot should return correct value", () => {
            // arrange
            const jackpot = null;
            const expectedValue = {
                winningLines: [
                    {
                        payline: 1,
                        symbol: 2,
                        count: 2,
                        positions: [0, 3, 6, 9, 12],
                    },
                ],
                bonus: { symbol: 1, count: 2 },
                freeSpins: { symbol: 2, count: 3 },
                jackpot: null,
            };

            // act
            const actualValue = consumer.collectRoundSettlementResult({ winningPaylines, bonus, freeSpins, jackpot });

            // assert
            expect(actualValue).toStrictEqual(expectedValue);
        });
    });

    describe("collectRoundResult", () => {
        it("should return correct value", () => {
            // arrange
            const dependencies = initDependencies();
            dependencies.freeSpinsConsumer.getTotalAvaiableFreeSpins.mockReturnValueOnce(8);

            const consumer = new SettleGameRoundConsumer(dependencies);
            consumer.collectRoundSettlementResult = jest.fn();
            consumer.collectRoundSettlementResult.mockReturnValueOnce(5);
            const roundId = 1;
            const betByFreeSpin = 2;
            const result = 3;
            const settlementResult = 4;
            const betWin = 6;
            const bigWin = 7;
            const player = {};
            const expectedValue = {
                finish: {
                    roundId: 1,
                    betByFreeSpin: 2,
                    result: 3,
                    settlementResult: 5,
                    betWin: 6,
                    bigWin: 7,
                    totalOfFreeSpins: 8,
                },
            };

            // act
            const actualValue = consumer.collectRoundResult({ player, result, settlementResult, roundId, betWin, bigWin, betByFreeSpin });

            // assert
            expect(actualValue).toStrictEqual(expectedValue);
        });
    });

    describe("calculateBonusAmount", () => {
        const testCases = [
            { bonusChests: [{ amount: 10 }], expectedValue: 10 },
            { bonusChests: undefined, expectedValue: 0 },
        ];
        it.each(testCases)("should return correct value", (testCase) => {
            // arrange
            const consumer = new SettleGameRoundConsumer(initDependencies());

            // act
            const actualValue = consumer.calculateBonusAmount(testCase.bonusChests);

            // assert
            expect(actualValue).toStrictEqual(testCase.expectedValue);
        });
    });

    describe("calculatePaylineResult", () => {
        it("when big win should return correct value", () => {
            // arrange
            const dependencies = initDependencies();
            const consumer = new SettleGameRoundConsumer(dependencies);
            const paylines = [{ odds: 2 }];
            const bet = {
                bet: 10,
                totalAmount: 3,
            };
            const expectedValue = {
                totalBetAmount: 3,
                totalWin: 20,
                netWin: 17,
                totalLost: 0,
                winningLines: [],
                bigWin: true,
            };

            // act
            const actualValue = consumer.calculatePaylineResult(paylines, bet);

            // assert
            expect(actualValue).toStrictEqual(expectedValue);
        });

        it("when lost should return correct value", () => {
            // arrange
            const dependencies = initDependencies();
            const consumer = new SettleGameRoundConsumer(dependencies);
            const paylines = [{ odds: 2 }];
            const bet = {
                bet: 10,
                totalAmount: 30,
            };
            const bonus = 0;
            const expectedValue = {
                totalBetAmount: 30,
                totalWin: 20,
                netWin: -10,
                totalLost: 10,
                winningLines: [],
                bigWin: false,
            };

            // act
            const actualValue = consumer.calculatePaylineResult(paylines, bet, bonus);

            // assert
            expect(actualValue).toStrictEqual(expectedValue);
        });
    });

    describe("queryBets", () => {
        it("should return value from roundsRepository", () => {
            // arrange
            const dependencies = initDependencies();
            dependencies.roundsRepository = {
                findOne: () => {
                    return { exec: () => 1 };
                },
            };
            const consumer = new SettleGameRoundConsumer(dependencies);

            // act
            const actualValue = consumer.queryBets(4);

            // assert
            expect(actualValue).toStrictEqual(1);
        });
    });

    describe("formatEndGameInfo", () => {
        it("when not freeSpin should return correct value", () => {
            // arrange
            const dependencies = initDependencies();
            dependencies.definition = { id: 5 };
            const consumer = new SettleGameRoundConsumer(dependencies);
            const bet = { memberId: 2, playerId: 12, siteId: 3, freeBet: false };
            const roundId = 1;
            const time = 4;
            const betResult = { totalBetAmount: 10 };
            const expectedValue = {
                gameInfo: {
                    gameId: 5,
                    gameRoundId: 1,
                    memberId: 2,
                    siteId: 3,
                    time: 4,
                    partnerId: undefined,
                    operatorId: undefined,
                    playerId: 2,
                },
                settlementInfo: { redPlay: 10, freeBet: false },
            };

            // act
            const actualValue = consumer.formatEndGameInfo(bet, roundId, time, betResult);

            // assert
            expect(actualValue).toStrictEqual(expectedValue);
        });

        it("when freeSpin should return correct value", () => {
            // arrange
            const dependencies = initDependencies();
            dependencies.definition = { id: 5 };
            const consumer = new SettleGameRoundConsumer(dependencies);
            const bet = { memberId: 2, playerId: 12, siteId: 3, freeBet: true, freeSpin: true };
            const roundId = 1;
            const time = 4;
            const betResult = { totalBetAmount: 10 };
            const expectedValue = {
                gameInfo: {
                    gameId: 5,
                    gameRoundId: 1,
                    memberId: 2,
                    siteId: 3,
                    time: 4,
                    partnerId: undefined,
                    operatorId: undefined,
                    playerId: 2,
                },
                settlementInfo: { redPlay: 0, freeBet: true },
            };

            // act
            const actualValue = consumer.formatEndGameInfo(bet, roundId, time, betResult);

            // assert
            expect(actualValue).toStrictEqual(expectedValue);
        });
    });

    describe("settleBets", () => {
        it("when not have bet should not call consumer.callEndGame", async () => {
            // arrange
            const dependencies = initDependencies();
            const consumer = new SettleGameRoundConsumer(dependencies);
            consumer.callEndGame = jest.fn();
            const player = {};
            const result = {};
            const settlementResult = {};
            const roundId = {};
            const bet = null;

            // act
            await consumer.settleBets(player, { result, settlementResult, roundId }, bet);

            // assert
            expect(consumer.callEndGame).not.toBeCalled();
        });

        it("when have bet should call consumer.callEndGame", async () => {
            // arrange
            const dependencies = initDependencies();
            dependencies.gameData.ingame = { player1: {} };
            const consumer = new SettleGameRoundConsumer(dependencies);
            consumer.callEndGame = jest.fn();
            consumer.calculateBonusAmount = jest.fn();
            consumer.calculatePaylineResult = jest.fn();
            consumer.collectRoundResult = jest.fn();
            consumer.calculatePaylineResult.mockReturnValueOnce({ totalWin: 10 });
            const player = { profile: { name: "player1" } };
            const result = {};
            const settlementResult = {};
            const roundId = {};
            const bet = { result: [], save: () => {} };
            const bonusChests = [];

            // act
            await consumer.settleBets(player, { result, settlementResult, roundId }, bet, bonusChests);

            // assert
            expect(consumer.callEndGame).toBeCalled();
        });

        it("when have bigWin should call hallOfFameConsumer.add", async () => {
            // arrange
            const dependencies = initDependencies();
            dependencies.gameData.ingame = { player1: {} };
            const consumer = new SettleGameRoundConsumer(dependencies);
            consumer.callEndGame = jest.fn();
            consumer.calculateBonusAmount = jest.fn();
            consumer.calculatePaylineResult = jest.fn();
            consumer.collectRoundResult = jest.fn();
            consumer.calculatePaylineResult.mockReturnValueOnce({ totalWin: 10, bigWin: true });
            const player = { profile: { name: "player1" } };
            const result = {};
            const settlementResult = {};
            const roundId = {};
            const bet = { result: [{ id: 1 }], save: () => {}, paylines: [] };
            const bonusChests = [];

            // act
            await consumer.settleBets(player, { result, settlementResult, roundId }, bet, bonusChests);

            // assert
            expect(consumer.hallOfFameConsumer.add).toBeCalled();
        });
    });

    describe("processJackpot", () => {
        it("when have error should call jackpotPublisher.publishFailedJackpot", async () => {
            // arrange
            const dependencies = initDependencies();
            dependencies.jackpotConsumer.hit.mockReturnValueOnce({ amount: 10 });
            dependencies.definition = {};

            const consumer = new SettleGameRoundConsumer(dependencies);
            consumer.hitJackpot = jest.fn();
            consumer.hitJackpot.mockReturnValueOnce({ isOk: false, response: { message: "error" } });
            const player = {};
            const roundId = {};
            const betAmount = null;
            const winningLine = {};

            // act
            await consumer.processJackpot(player, roundId, betAmount, winningLine);

            // assert
            expect(consumer.jackpotPublisher.publishFailedJackpot).toBeCalled();
        });

        it("when not have error should not call jackpotPublisher.publishFailedJackpot", async () => {
            // arrange
            const dependencies = initDependencies();
            dependencies.jackpotConsumer.hit.mockReturnValueOnce({ amount: 10 });
            dependencies.definition = {};

            const consumer = new SettleGameRoundConsumer(dependencies);
            consumer.hitJackpot = jest.fn();
            consumer.hitJackpot.mockReturnValueOnce({ isOk: true, response: {} });
            const player = {};
            const roundId = {};
            const betAmount = null;
            const winningLine = {};

            // act
            await consumer.processJackpot(player, roundId, betAmount, winningLine);

            // assert
            expect(consumer.jackpotPublisher.publishFailedJackpot).not.toBeCalled();
        });
    });

    describe("processFreeSpins", () => {
        it("when freeSpins.odd > 0 should call freeSpinsConumer.gainFreeSpin", async () => {
            // arrange
            const dependencies = initDependencies();
            dependencies.definition = {};

            const consumer = new SettleGameRoundConsumer(dependencies);
            consumer.hitJackpot = jest.fn();
            consumer.hitJackpot.mockReturnValueOnce({ isOk: false, response: { message: "error" } });
            const player = {};
            const betTicket = {};
            const settlementResult = { freeSpins: { odds: 2 } };

            // act
            await consumer.processFreeSpins(player, betTicket, settlementResult);

            // assert
            expect(consumer.freeSpinsConumer.gainFreeSpin).toBeCalled();
        });

        const testCases = [{ settlementResult: { freeSpins: { odds: 0 } } }, { settlementResult: { freeSpins: undefined } }];
        it.each(testCases)("when not have freeSpins or odd <= 0 should not call freeSpinsConumer.gainFreeSpin", async (testCase) => {
            // arrange
            const dependencies = initDependencies();
            dependencies.definition = {};

            const consumer = new SettleGameRoundConsumer(dependencies);
            consumer.hitJackpot = jest.fn();
            consumer.hitJackpot.mockReturnValueOnce({ isOk: false, response: { message: "error" } });
            const player = {};
            const betTicket = {};
            const settlementResult = testCase.settlementResult;

            // act
            await consumer.processFreeSpins(player, betTicket, settlementResult);

            // assert
            expect(consumer.freeSpinsConumer.gainFreeSpin).not.toBeCalled();
        });
    });

    describe("processBonus", () => {
        it("should call userBetResultPublisher.publishToUser", async () => {
            // arrange
            const dependencies = initDependencies();
            dependencies.definition = {};
            dependencies.gameData.ingame = { player1: {} };

            const consumer = new SettleGameRoundConsumer(dependencies);
            consumer.collectBonusResult = jest.fn();
            const player = { profile: { name: "player1" } };
            const finish = {};
            const bet = { save: jest.fn(), paylines: [] };

            // act
            await consumer.processBonus(player, finish, bet);

            // assert
            expect(consumer.userBetResultPublisher.publishToUser).toBeCalled();
        });
    });

    describe("isUserEnableJackpot", () => {
        it("when currency is test currency and jackpot.excludeTestCurrency should return false", async () => {
            // arrange
            const dependencies = initDependencies();
            dependencies.definition = {};
            dependencies.gameData.gameConfigs.slotsConfig.jackpot.excludeTestCurrency = true;
            dependencies.gameData.currencies = [{ name: "UUS", isTest: true }];
            const consumer = new SettleGameRoundConsumer(dependencies);
            const player = { session: { currencyName: "UUS" } };

            // act
            const actualValue = consumer.isUserEnableJackpot(player);

            // assert
            expect(actualValue).toBe(false);
        });

        it("when currency is UUS and jackpot not excludeUUS should return true", async () => {
            // arrange
            const dependencies = initDependencies();
            dependencies.definition = {};
            dependencies.gameData.gameConfigs.slotsConfig.jackpot.excludeTestCurrency = false;
            dependencies.gameData.currencies = [{ name: "UUS", isTest: true }];
            const consumer = new SettleGameRoundConsumer(dependencies);
            const player = { session: { currencyName: "UUS" } };

            // act
            const actualValue = consumer.isUserEnableJackpot(player);

            // assert
            expect(actualValue).toBe(true);
        });

        it("when currency is not UUS should return true", async () => {
            // arrange
            const dependencies = initDependencies();
            dependencies.definition = {};
            dependencies.gameData.gameConfigs.slotsConfig.jackpot.excludeTestCurrency = true;
            dependencies.gameData.currencies = [{ name: "IN", isTest: false }];
            const consumer = new SettleGameRoundConsumer(dependencies);
            const player = { session: { currencyName: "IN" } };

            // act
            const actualValue = consumer.isUserEnableJackpot(player);

            // assert
            expect(actualValue).toBe(true);
        });
    });

    describe("generateRoundResult", () => {
        let testCases = [
            { enableJackpot: false },
            { enableJackpot: true, jackpotPayline: -1 },
            { enableJackpot: true, jackpotPayline: 1, userEnableJackpot: false },
        ];
        it.each(testCases)("when [jackpot.enabled false or jackpotPayline==-1 or UserEnableJackpot false] should return 0", async (testCase) => {
            // arrange
            const dependencies = initDependencies();
            dependencies.definition = {};
            dependencies.gameData.gameConfigs.slotsConfig.jackpot.enabled = testCase.enableJackpot;

            const consumer = new SettleGameRoundConsumer(dependencies);
            spyOn(consumer.paylineCalculator, "calculate").and.returnValue({ paylines: [], jackpotPayline: testCase.jackpotPayline });
            spyOn(consumer, "isUserEnableJackpot").and.returnValue(testCase.userEnableJackpot);
            const player = { session: { currencyName: "UUS" } };
            const roundId = 1;
            const bet = {};

            // act
            const actualValue = await consumer.generateRoundResult(player, roundId, bet);

            // assert
            expect(actualValue.jackpotWin).toBe(0);
        });

        testCases = [
            { jackpot: { winningAmount: 10 }, expectedValue: 10 },
            { jackpot: null, expectedValue: 0 },
        ];
        it.each(testCases)(
            "when [jackpot.enabled true and jackpotPayline > -1 and UserEnableJackpot true] should return correct jackpotWin",
            async (testCase) => {
                // arrange
                const dependencies = initDependencies();
                dependencies.definition = {};
                dependencies.gameData.gameConfigs.slotsConfig.jackpot.enabled = true;

                const consumer = new SettleGameRoundConsumer(dependencies);
                spyOn(consumer.paylineCalculator, "calculate").and.returnValue({ paylines: [], jackpotPayline: 1 });
                spyOn(consumer, "isUserEnableJackpot").and.returnValue(true);
                spyOn(consumer, "processJackpot").and.returnValue(testCase.jackpot);
                const player = { session: { currencyName: "UUS" } };
                const roundId = 1;
                const bet = {};

                // act
                const actualValue = await consumer.generateRoundResult(player, roundId, bet);

                // assert
                expect(actualValue.jackpotWin).toBe(testCase.expectedValue);
            }
        );
    });
});

function initDependencies() {
    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongoose(mongoose.Model);

    /** @type {mongoose.Model}*/
    const betsRepository = stubMongoose(mongoose.Model);

    const gameDefinition = stubGameDefinition();
    const gameData = stubGameData();
    const roundResultPublisher = stub(RoundResultPublisher);
    const userBetResultPublisher = stub(UserBetResultPublisher);
    const jackpotPublisher = stub(JackpotPublisher);
    const boardCheatingConsumer = stub(BoardCheatingConsumer);
    const freeSpinsConsumer = stub(FreeSpinsConsumer);
    const hallOfFameConsumer = stub(HallOfFameConsumer);
    const jackpotConsumer = stub(JackpotConsumer);
    const boardGenerator = stub(BoardGenerator);
    const bonusBoardGenerator = stub(BonusBoardGenerator);
    const paylineCalculator = new PaylineCalculator();
    const endGame = jest.fn();
    const hitJackpot = jest.fn();

    return {
        gameDefinition,
        gameData,
        roundResultPublisher,
        userBetResultPublisher,
        jackpotPublisher,
        boardCheatingConsumer,
        freeSpinsConsumer,
        hallOfFameConsumer,
        jackpotConsumer,
        boardGenerator,
        bonusBoardGenerator,
        paylineCalculator,
        endGame,
        hitJackpot,
        roundsRepository,
        betsRepository,
    };
}

function stubGameData() {
    const gameData = new SlotGameData();

    gameData.remainingTime = 20;
    gameData.gameConfigs = {
        enabled: true,
        minbet: 1,
        maxbet: 1000,
        slotsConfig: {
            mode: 3,
            stakeLevels: [{ stake: 0.1 }, { stake: 1 }, { stake: 5 }],
            jackpot: {
                enabled: true,
                excludeUUS: true,
                winningRatio: 0.98,
                playerContributionRatio: 0.025,
                botContributionRatio: 0.005,
            },
            icons: odds,
            bigWinRatio: 4,
            bonus: {
                bonusConfig: {},
            },
        },
    };

    return gameData;
}

function stubGameDefinition() {
    return new SlotGameDefinition({
        choices: [1, 2, 3, 4, 5],
    });
}

function stubPlayer() {
    return {
        UID: "123",
        profile: {
            name: "player",
            minBet: 1,
            maxBet: 500,
        },
        session: {
            currency: "US",
        },
    };
}

function stubPayload(chest = 2) {
    return {
        chest,
    };
}

function stubBonusChests(picked = false) {
    return [
        { amount: 5, picked },
        { amount: 6, picked },
        { amount: 7, picked },
        { amount: 8, picked },
        { amount: 9, picked },
        { amount: 5, picked: false },
        { amount: 6, picked: false },
        { amount: 7, picked: false },
        { amount: 8, picked: false },
        { amount: 9, picked: false },
    ];
}

function stubFinish() {
    return {
        roundId: 1,
        settlementResult: {
            bonus: { count: 5, odds: 5 },
        },
        time: Date.now() - 3000 * 60,
    };
}
