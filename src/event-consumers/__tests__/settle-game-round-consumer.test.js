import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
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
});

function initDependencies() {
    /** @type {mongoose.Model}*/
    const roundsRepository = stubMongooseModelStupidly(mongoose.Model);

    /** @type {mongoose.Model}*/
    const betsRepository = stubMongooseModelStupidly(mongoose.Model);

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
