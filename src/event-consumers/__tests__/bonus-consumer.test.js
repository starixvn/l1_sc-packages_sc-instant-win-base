import { stub } from "jest-micro-auto-stub";

import SettleGameRoundConsumer from "../../event-consumers/settle-game-round-consumer";
import BonusPublisher from "../../event-publishers/bonus-publisher";
import SlotNoticeHelper from "../../helpers/slot-notice-helper";
import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";
import BonusConsumer from "../bonus-consumer";

const gameDefinition = stubGameDefinition();
const publisher = stub(BonusPublisher);
const settleConsumer = stub(SettleGameRoundConsumer);

describe("validate", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should return invalidBonus when bonus chests does not exist", () => {
        // arrange
        const consumer = new BonusConsumer(gameDefinition, stubGameData(), publisher, settleConsumer);
        const player = stubPlayer();

        // act
        const isValid = consumer.validate(stubPlayer(), 2);

        // assert
        expect(isValid).toBeFalse();
        expect(publisher.publishToUser).toBeCalledWith(player.UID, { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidBonus } });
    });

    it("should return invalidBonus if all were picked", () => {
        // arrange
        const gameData = stubGameData();
        const player = stubPlayer();
        gameData.ingame[player.profile.name] = { bonusChests: stubBonusChests(true), finish: stubFinish() };
        const consumer = new BonusConsumer(gameDefinition, gameData, publisher, settleConsumer);

        // act
        const isValid = consumer.validate(stubPlayer(), 2);

        // assert
        expect(isValid).toBeFalse();
        expect(publisher.publishToUser).toBeCalledWith(player.UID, { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidBonus } });
    });

    it("should return invalidBonus if chest is not a number", () => {
        // arrange
        const gameData = stubGameData();
        const player = stubPlayer();
        gameData.ingame[player.profile.name] = { bonusChests: stubBonusChests(), finish: stubFinish() };
        const consumer = new BonusConsumer(gameDefinition, gameData, publisher, settleConsumer);

        // act
        const isValid = consumer.validate(stubPlayer(), "a");

        // assert
        expect(isValid).toBeFalse();
        expect(publisher.publishToUser).toBeCalledWith(player.UID, { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidBonus } });
    });

    it("should return invalidBonus if chest is less than 0", () => {
        // arrange
        const gameData = stubGameData();
        const player = stubPlayer();
        gameData.ingame[player.profile.name] = { bonusChests: stubBonusChests(), finish: stubFinish() };
        const consumer = new BonusConsumer(gameDefinition, gameData, publisher, settleConsumer);

        // act
        const isValid = consumer.validate(stubPlayer(), -1);

        // assert
        expect(isValid).toBeFalse();
        expect(publisher.publishToUser).toBeCalledWith(player.UID, { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidBonus } });
    });

    it("should return invalidBonus if chest is greater than bonus size", () => {
        // arrange
        const gameData = stubGameData();
        const player = stubPlayer();
        gameData.ingame[player.profile.name] = { bonusChests: stubBonusChests(), finish: stubFinish() };
        const consumer = new BonusConsumer(gameDefinition, gameData, publisher, settleConsumer);

        // act
        const isValid = consumer.validate(stubPlayer(), gameDefinition.bonusSize + 1);

        // assert
        expect(isValid).toBeFalse();
        expect(publisher.publishToUser).toBeCalledWith(player.UID, { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidBonus } });
    });

    const testCases = [{ bonusChests: stubBonusChests() }];
    it.each(testCases)("should return true if bonus chest is valid", (testCase) => {
        // arrange
        const gameData = stubGameData();
        const player = stubPlayer();
        gameData.ingame[player.profile.name] = { bonusChests: testCase.bonusChests, finish: stubFinish() };
        const consumer = new BonusConsumer(gameDefinition, gameData, publisher, settleConsumer);

        // act
        const isValid = consumer.validate(stubPlayer(), 2);

        // assert
        expect(isValid).toBeTrue();
        expect(publisher.publishToUser).not.toBeCalled();
    });
});

describe("consume", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should NOT publish bonus if invalid", async () => {
        // arrange
        const consumer = new BonusConsumer(gameDefinition, stubGameData(), publisher, settleConsumer);

        // act
        await consumer.consume(stubPlayer(), stubPayload());

        // assert
        expect(publisher.publishBonus).not.toBeCalled();
    });

    it("should publish bonus if valid", async () => {
        // arrange
        const gameData = stubGameData();
        const player = stubPlayer();
        gameData.ingame[player.profile.name] = { bonusChests: stubBonusChests(), finish: stubFinish() };
        const consumer = new BonusConsumer(gameDefinition, gameData, publisher, settleConsumer);

        // act
        await consumer.consume(stubPlayer(), stubPayload());

        // assert
        expect(publisher.publishBonus).toBeCalledWith(player.UID, { chest: 2, amount: 7 });
    });

    it("should settle round if all bonus chests were picked", async () => {
        // arrange
        const gameData = stubGameData();
        const player = stubPlayer();
        const finish = stubFinish();
        const bonusChests = stubBonusChests(true);
        bonusChests[2].picked = false;
        gameData.ingame[player.profile.name] = { bonusChests, finish };
        const consumer = new BonusConsumer(gameDefinition, gameData, publisher, settleConsumer);

        // act
        await consumer.consume(stubPlayer(), stubPayload());

        // assert
        expect(settleConsumer.autoSettleRound).toBeCalledWith(player, finish.roundId);
    });
});

describe("processExpiredBonus", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should not call auto settle if not have any bonuses", async () => {
        // arrange
        const consumer = new BonusConsumer(gameDefinition, stubGameData(), publisher, settleConsumer);

        // act
        await consumer.processExpiredBonus();

        // assert
        expect(settleConsumer.autoSettleRound).not.toBeCalled();
    });

    it("should publish bonusses and call auto settle after opening chests", async () => {
        // arrange
        const gameData = stubGameData();
        gameData.ingame["player"] = {
            finish: stubFinish(),
            bonusChests: stubBonusChests(),
            player: stubPlayer(),
        };
        const consumer = new BonusConsumer(gameDefinition, gameData, publisher, settleConsumer);

        // act
        await consumer.processExpiredBonus();

        // assert
        expect(publisher.publishBonus).toBeCalled();
        expect(settleConsumer.autoSettleRound).toBeCalled();
    });
});

describe("autoOpenRemainingChests", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("when player not in game should not call settleConsumer.autoSettleRound", async () => {
        // arrange
        const gameData = stubGameData();
        gameData.ingame["player"] = null;

        const consumer = new BonusConsumer(gameDefinition, gameData, publisher, settleConsumer);
        const player = { profile: { name: "player" } };

        // act
        await consumer.autoOpenRemainingChests(player);

        // assert
        expect(settleConsumer.autoSettleRound).not.toBeCalled();
    });

    it("when player in game and not have bonus should not call settleConsumer.autoSettleRound", async () => {
        // arrange
        const gameData = stubGameData();
        gameData.ingame["player"] = {
            finish: stubFinish(),
            bonusChests: null,
            player: stubPlayer(),
        };

        const consumer = new BonusConsumer(gameDefinition, gameData, publisher, settleConsumer);
        const player = { profile: { name: "player" } };

        // act
        await consumer.autoOpenRemainingChests(player);

        // assert
        expect(settleConsumer.autoSettleRound).not.toBeCalled();
    });

    it("when player in game and all chests picked should not call settleConsumer.autoSettleRound", async () => {
        // arrange
        const gameData = stubGameData();
        gameData.ingame["player"] = {
            finish: stubFinish(),
            bonusChests: [
                { amount: 5, picked: true },
                { amount: 6, picked: true },
                { amount: 7, picked: true },
                { amount: 8, picked: true },
                { amount: 9, picked: true },
                { amount: 5, picked: true },
                { amount: 6, picked: true },
                { amount: 7, picked: true },
                { amount: 8, picked: true },
                { amount: 9, picked: true },
            ],
            player: stubPlayer(),
        };

        const consumer = new BonusConsumer(gameDefinition, gameData, publisher, settleConsumer);
        const player = { profile: { name: "player" } };

        // act
        await consumer.autoOpenRemainingChests(player);

        // assert
        expect(settleConsumer.autoSettleRound).not.toBeCalled();
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
            stakeLevels: [{ stake: 0.1 }, { stake: 1 }, { stake: 5 }],
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
            currencyName: "US",
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
