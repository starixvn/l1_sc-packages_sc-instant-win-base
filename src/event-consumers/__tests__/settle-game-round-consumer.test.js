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

beforeEach(() => {
    jest.clearAllMocks();
});

describe("SettleGameRoundConsumer", () => {
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
            const bet = { bet: 1, paylines: [1, 2, 3], name: player.profile.name, rate: 1 };
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
            const bet = { bet: 1, paylines: [1, 2, 3], name: player.profile.name, rate: 1 };
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
            const bet = { bet: 1, paylines: [1, 2, 3], name: player.profile.name, rate: 1 };
            const board = [1, 2, 2, 1, 4, 4, 1, 9, 3, 4, 1, 2, 7, 2, 2];
            consumer.boardGenerator.generate.mockReturnValueOnce(board);
            consumer.boardCheatingConsumer.consume.mockReturnValueOnce(board);
            consumer.gameData.gameConfigs.slotsConfig.jackpot.enabled = true;
            spyOn(consumer, "queryBets").and.returnValue(bet);
            spyOn(consumer, "settleBets");
            consumer.jackpotValidator.canContributeJackpotPools.mockReturnValueOnce(true);

            // act
            await consumer.settleRound(player, 1);

            // assert
            expect(consumer.jackpotConsumer.contribute).toBeCalled();
        });

        it("when user cant contribute jackpot should not call jackpotConsumer.contribute", async () => {
            // arrange
            const consumer = new SettleGameRoundConsumer(initDependencies());
            const player = stubPlayer();
            const bet = { bet: 1, paylines: [1, 2, 3], name: player.profile.name, freeSpin: false, rate: 1 };
            const board = [1, 2, 2, 1, 4, 4, 1, 9, 3, 4, 1, 2, 7, 2, 2];
            consumer.boardGenerator.generate.mockReturnValueOnce(board);
            consumer.boardCheatingConsumer.consume.mockReturnValueOnce(board);
            consumer.gameData.gameConfigs.slotsConfig.jackpot.enabled = true;
            spyOn(consumer, "queryBets").and.returnValue(bet);
            consumer.jackpotValidator.canContributeJackpotPools.mockReturnValueOnce(false);
            spyOn(consumer, "settleBets");

            // act
            await consumer.settleRound(player, 1);

            // assert
            expect(consumer.jackpotConsumer.contribute).not.toBeCalled();
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
