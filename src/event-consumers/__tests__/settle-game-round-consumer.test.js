import { Core } from "sc-game-base";
import { SettleGameRoundConsumer } from "..";
import odds from "../../../tests/odds";

import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";
import defaultDefinition from "../../board/default-definition";

import {
    roundsRepository,
    betsRepository,
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
    generateResultConsumer,
} from "./stubs";

describe("SettleGameRoundConsumer", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("instance should inherit Core.SettleGameRoundConsumer", () => {
        // act
        const consumer = new SettleGameRoundConsumer(initDependencies());

        // assert
        expect(consumer instanceof Core.BaseEventConsumers.SettleGameRoundConsumer);
    });

    describe("generateRoundResult", () => {
        let betMock;
        let consumer;

        beforeEach(() => {
            betMock = {
                save: jest.fn(),
                time: "2024-07-11T10:00:00Z",
            };

            consumer = new SettleGameRoundConsumer(initDependencies());
        });

        it("should call generateSettlementResult with correct arguments", async () => {
            // Arrange
            const player = "player1";
            const roundId = "round123";
            const bet = { ...betMock };
            generateResultConsumer.generateSettlementResult.mockReturnValueOnce({ result: {}, settlementResult: {} });

            // Act
            await consumer.generateRoundResult(player, roundId, bet);

            // Assert
            expect(generateResultConsumer.generateSettlementResult).toHaveBeenCalledWith(bet, odds);
        });

        it("should update bet with result and settlementResult", async () => {
            // Arrange
            const player = "player1";
            const roundId = "round123";
            const bet = { ...betMock };
            const result = { result: "result" };
            const settlementResult = { settlementResult: "settlementResult" };
            generateResultConsumer.generateSettlementResult.mockReturnValueOnce({ result, settlementResult });

            // Act
            await consumer.generateRoundResult(player, roundId, bet);

            // Assert
            expect(bet.result).toEqual(result);
            expect(bet.settlementResult).toEqual(settlementResult);
        });

        it("should call generateBonus with correct arguments", async () => {
            // Arrange
            const player = "player1";
            const roundId = "round123";
            const bet = { ...betMock };
            const bonusChests = { bonusChests: "bonusChests" };
            const { bonus: bonusConfig } = consumer.gameData.gameConfigs.slotsConfig;
            generateResultConsumer.generateSettlementResult.mockReturnValueOnce({ result: {}, settlementResult: {} });
            generateResultConsumer.generateBonus.mockReturnValueOnce(bonusChests);

            // Act
            await consumer.generateRoundResult(player, roundId, bet);

            // Assert
            expect(generateResultConsumer.generateBonus).toHaveBeenCalledWith(bet, bonusConfig);
            expect(bet.bonusChests).toEqual(bonusChests);
        });

        it("should save the bet", async () => {
            // Arrange
            const player = "player1";
            const roundId = "round123";
            const bet = { ...betMock };
            generateResultConsumer.generateSettlementResult.mockReturnValueOnce({ result: {}, settlementResult: {} });

            // Act
            await consumer.generateRoundResult(player, roundId, bet);

            // Assert
            expect(bet.save).toHaveBeenCalled();
        });

        it("should return the correct round result", async () => {
            // Arrange
            const player = "player1";
            const roundId = "round123";
            const bet = { ...betMock };
            const result = { result: "result" };
            const settlementResult = { settlementResult: "settlementResult" };
            generateResultConsumer.generateSettlementResult.mockReturnValue({ result, settlementResult });

            // Act
            const roundResult = await consumer.generateRoundResult(player, roundId, bet);

            // Assert
            expect(roundResult).toEqual({
                roundId,
                result,
                settlementResult,
                time: "2024-07-11T10:00:00Z",
            });
        });

        it("should handle errors when save fails", async () => {
            // Arrange
            const player = "player1";
            const roundId = "round123";
            const bet = { ...betMock };
            generateResultConsumer.generateSettlementResult.mockReturnValue({ result: {}, settlementResult: {} });
            bet.save.mockRejectedValue(new Error("Save failed"));

            // Act & Assert
            await expect(consumer.generateRoundResult(player, roundId, bet)).rejects.toThrow("Save failed");
        });
    });

    describe("publishJackpotPrize", () => {
        let consumer;
        const finish = {
            settlementResult: {
                jackpotPayline: "payline1",
            },
            result: { board: "board1" },
            roundId: "round1",
        };
        const prizes = [{ prize1: "prize1" }];
        const player = { profile: { name: "player1" } };
        const bet = { uid: "user1" };

        beforeEach(() => {
            consumer = new SettleGameRoundConsumer(initDependencies());
            consumer.gameData.ingame["player1"] = player;
        });

        it("should set the jackpot and publish the result to the user", async () => {
            // Arrange

            // Act
            await consumer.publishJackpotPrize(finish, prizes, player, bet);

            // Assert
            expect(consumer.gameData.ingame["player1"].jackpot).toEqual({
                winningLine: "payline1",
                picked: false,
                prizes,
                winningAmount: 0,
            });

            expect(userBetResultPublisher.publishToUser).toHaveBeenCalledWith("user1", {
                jackpot: {
                    result: finish.result,
                    bonus: prizes.length,
                    roundId: "round1",
                },
            });
        });

        it("should call collectJackpotResult with correct parameters", async () => {
            // Arrange
            const collectJackpotResultSpy = jest.spyOn(consumer, "collectJackpotResult");

            // Act
            await consumer.publishJackpotPrize(finish, prizes, player, bet);

            // Assert
            expect(collectJackpotResultSpy).toHaveBeenCalledWith({
                result: finish.result,
                settlementResult: finish.settlementResult,
                roundId: finish.roundId,
                prizes,
            });
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
            const bet = { playerId: 2, siteId: 3, freeBet: false };
            const roundId = 1;
            const time = 4;
            const betResult = { totalBetAmount: 10 };
            const expectedValue = {
                gameInfo: {
                    gameId: 5,
                    gameRoundId: 1,
                    siteId: 3,
                    time: 4,
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
            const bet = { playerId: 2, siteId: 3, freeBet: true, freeSpin: true };
            const roundId = 1;
            const time = 4;
            const betResult = { totalBetAmount: 10 };
            const expectedValue = {
                gameInfo: {
                    gameId: 5,
                    gameRoundId: 1,
                    siteId: 3,
                    time: 4,
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
        dependencies.generateResultConsumer.boardDefinition = defaultDefinition;
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
                bonus: { symbol: 8, count: 2 },
                freeSpins: { symbol: 7, count: 3 },
                jackpot: { jackpotId: 1, symbol: 10, positions: undefined },
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
                bonus: { symbol: 8, count: 2 },
                freeSpins: { symbol: 7, count: 3 },
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
            await consumer.processJackpot(player, roundId, { betAmount, rate: 1 }, winningLine);

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
            await consumer.processJackpot(player, roundId, { betAmount, rate: 1 }, winningLine);

            // assert
            expect(consumer.jackpotPublisher.publishFailedJackpot).not.toBeCalled();
        });
    });

    describe("settleBets", () => {
        it("when error should logError", async () => {
            // arrange
            const dependencies = initDependencies();
            const consumer = new SettleGameRoundConsumer(dependencies);
            consumer.callEndGame = async () => {
                throw new Exception();
            };
            const player = {};
            const result = {};
            const settlementResult = {};
            const roundId = {};
            const bet = {};

            // act
            await consumer.settleBets(player, { result, settlementResult, roundId }, bet);

            // assert
            expect(dependencies.logService.logError).toBeCalled();
        });

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

    describe("settleRound", () => {
        let consumer;
        let queryBetsMock;
        let generateRoundResultMock;
        let processFreeSpinsMock;
        let settleJackpotMock;
        let updateBetTrackMock;
        let publishJackpotPrizeMock;
        let settleAfterJackpotMock;

        beforeEach(() => {
            consumer = new SettleGameRoundConsumer(initDependencies());

            queryBetsMock = jest.spyOn(consumer, "queryBets");
            generateRoundResultMock = jest.spyOn(consumer, "generateRoundResult");

            processFreeSpinsMock = jest.spyOn(consumer, "processFreeSpins");
            processFreeSpinsMock.mockReturnValueOnce({});

            settleJackpotMock = jest.spyOn(consumer, "settleJackpot");

            updateBetTrackMock = jest.spyOn(consumer, "updateBetTrack");
            updateBetTrackMock.mockReturnValueOnce({});

            publishJackpotPrizeMock = jest.spyOn(consumer, "publishJackpotPrize");
            publishJackpotPrizeMock.mockReturnValueOnce({});

            settleAfterJackpotMock = jest.spyOn(consumer, "settleAfterJackpot");
            settleAfterJackpotMock.mockReturnValueOnce({});
        });

        afterEach(() => {
            jest.clearAllMocks();
        });
        it("always call queryBets", async () => {
            // arrange
            const player = "player1";
            const roundId = "round123";
            queryBetsMock.mockReturnValueOnce(null);
            generateResultConsumer.generateSettlementResult.mockReturnValueOnce({ result: {}, settlementResult: {} });

            queryBetsMock.mockReturnValueOnce({ id: roundId });

            // act
            await consumer.settleRound(player, roundId);

            // assert
            expect(queryBetsMock).toBeCalledWith(roundId);
        });

        describe("when no bet is found", () => {
            it("should not proceed", async () => {
                // Arrange
                const player = "player1";
                const roundId = "round123";
                queryBetsMock.mockReturnValueOnce(null);

                // Act
                await consumer.settleRound(player, roundId);

                // Assert
                expect(generateRoundResultMock).not.toHaveBeenCalled();
                expect(processFreeSpinsMock).not.toHaveBeenCalled();
                expect(settleJackpotMock).not.toHaveBeenCalled();
                expect(updateBetTrackMock).not.toHaveBeenCalled();
                expect(publishJackpotPrizeMock).not.toHaveBeenCalled();
                expect(settleAfterJackpotMock).not.toHaveBeenCalled();
            });
        });

        describe("when bet is found", () => {
            const player = "player1";
            const roundId = "round123";
            const bet = { id: "bet1" };

            beforeEach(() => {
                queryBetsMock.mockReturnValueOnce(bet);
            });

            it("should call generateRoundResult", async () => {
                // Arrange
                const finish = { settlementResult: "settlementResult" };
                generateRoundResultMock.mockReturnValueOnce(finish);

                // Act
                await consumer.settleRound(player, roundId);

                // Assert
                expect(queryBetsMock).toHaveBeenCalledWith(roundId);
                expect(generateRoundResultMock).toHaveBeenCalledWith(player, roundId, bet);
            });

            it("should call processFreeSpins with correct arguments", async () => {
                // Arrange
                const finish = { settlementResult: "settlementResult" };
                generateRoundResultMock.mockReturnValueOnce(finish);

                // Act
                await consumer.settleRound(player, roundId);

                // Assert
                expect(processFreeSpinsMock).toHaveBeenCalledWith(player, bet, finish.settlementResult);
            });

            it("should call settleJackpot with correct arguments", async () => {
                // Arrange
                const finish = { settlementResult: "settlementResult" };
                generateRoundResultMock.mockReturnValueOnce(finish);

                // Act
                await consumer.settleRound(player, roundId);

                // Assert
                expect(settleJackpotMock).toHaveBeenCalledWith(player, finish.settlementResult);
            });

            it("should call updateBetTrack with correct arguments", async () => {
                // Arrange
                const finish = { settlementResult: "settlementResult" };
                generateRoundResultMock.mockReturnValueOnce(finish);

                // Act
                await consumer.settleRound(player, roundId);

                // Assert
                expect(updateBetTrackMock).toHaveBeenCalledWith(player, finish);
            });

            describe("when prizes are found", () => {
                it("should call publishJackpotPrize", async () => {
                    // Arrange
                    const finish = { settlementResult: "settlementResult" };
                    const prizes = [{ prize: "prize1" }];
                    generateRoundResultMock.mockReturnValueOnce(finish);
                    settleJackpotMock.mockReturnValueOnce(prizes);

                    // Act
                    await consumer.settleRound(player, roundId);

                    // Assert
                    expect(publishJackpotPrizeMock).toHaveBeenCalledWith(finish, prizes, player, bet);
                    expect(settleAfterJackpotMock).not.toHaveBeenCalled();
                });
            });

            describe("when NO prizes are found", () => {
                it("should call settleAfterJackpot", async () => {
                    // Arrange
                    const finish = { settlementResult: "settlementResult" };
                    queryBetsMock.mockReturnValueOnce(bet);
                    generateRoundResultMock.mockReturnValueOnce(finish);
                    settleJackpotMock.mockReturnValueOnce([]);

                    // Act
                    await consumer.settleRound(player, roundId);

                    // Assert
                    expect(settleAfterJackpotMock).toHaveBeenCalledWith(bet, roundId);
                });
            });
        });
    });
});

function initDependencies() {
    const gameDefinition = stubGameDefinition();
    const gameData = stubGameData();

    const logService = { logError: jest.fn() };
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
        logService,
        generateResultConsumer,
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
                excludeTestCurrency: true,
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
