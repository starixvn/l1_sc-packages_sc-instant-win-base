import mongoose from "mongoose";
import { Core } from "sc-game-base";
import { SettleGameRoundConsumer } from "..";
import odds from "../../../tests/odds";

import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";

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
    jackpotValidator,
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
        jackpotValidator,
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
