import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import { helpers } from "sc-common";
import { BaseEventPublishers } from "sc-game-base/src/core";

import SlotNoticeHelper from "../../helpers/slot-notice-helper";
import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";
import PlaceBetConsumer from "../place-bet-consumer";
import mongoose from "mongoose";

const gameData = stubGameData();
const gameDefinition = stubGameDefinition();
const publisher = stub(BaseEventPublishers);

describe("composeBettingTimeValidationCriteria", () => {
    it("should return placeBetNextRound when game was disabled", () => {
        // arrange
        gameData.gameConfigs.enabled = false;
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData);

        // act
        const criterions = placeBetConsumer.composeBettingTimeValidationCriteria();

        // assert
        expect(criterions).not.toBeEmpty();
        expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
            failure: true,
            notice: { errorCode: helpers.noticeHelper.placeBetNextRound },
        });
    });
});

describe("composeBetAmountValidationCriteria", () => {
    const currencyGroupGamesRepository = stubMongooseModelStupidly(mongoose.Model);

    it("should return invalidStakeLevel when amount is 0", async () => {
        // arrange
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData, undefined, currencyGroupGamesRepository);
        const amount = 0;

        // act
        const criterions = await placeBetConsumer.composeBetAmountValidationCriteria({ session: {} }, {}, amount, {});

        // assert
        expect(criterions.filter((x) => x.failure).length).toBe(2);
        expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
            failure: true,
            notice: { errorCode: SlotNoticeHelper.invalidStakeLevel },
        });
    });

    it("should return invalidStakeLevel when amount is less than 0", async () => {
        // arrange
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData, undefined, currencyGroupGamesRepository);
        const amount = -1;

        // act
        const criterions = await placeBetConsumer.composeBetAmountValidationCriteria({ session: {} }, {}, amount, {});

        // assert
        expect(criterions.filter((x) => x.failure).length).toBe(2);
        expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
            failure: true,
            notice: { errorCode: SlotNoticeHelper.invalidStakeLevel },
        });
    });

    it("should return invalidStakeLevel when amount is not belongs to stake level configurations", async () => {
        // arrange
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData, undefined, currencyGroupGamesRepository);
        const amount = 2;

        // act
        const criterions = await placeBetConsumer.composeBetAmountValidationCriteria({ session: {} }, {}, amount, {});

        // assert
        expect(criterions.filter((x) => x.failure).length).toBe(1);
        expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
            failure: true,
            notice: { errorCode: SlotNoticeHelper.invalidStakeLevel },
        });
    });
});

describe("composeBetChoiceValidationCriteria", () => {
    it("should return invalidPaylines when bet choices are empty", () => {
        // arrange
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData);
        const betChoices = [];

        // act
        const criterions = placeBetConsumer.composeBetChoiceValidationCriteria(betChoices);

        // assert
        expect(criterions.filter((x) => x.failure).length).toBe(1);
        expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
            failure: true,
            notice: { errorCode: SlotNoticeHelper.invalidPaylines },
        });
    });

    it("should return invalidPaylines when bet choices have duplications", () => {
        // arrange
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData);
        const betChoices = [1, 2, 3, 4, 5, 5];

        // act
        const criterions = placeBetConsumer.composeBetChoiceValidationCriteria(betChoices);

        // assert
        expect(criterions.filter((x) => x.failure).length).toBe(1);
        expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
            failure: true,
            notice: { errorCode: SlotNoticeHelper.invalidPaylines },
        });
    });

    it("should return invalidPaylines when bet choices are undefined", () => {
        // arrange
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData);
        const betChoices = [5, 6];

        // act
        const criterions = placeBetConsumer.composeBetChoiceValidationCriteria(betChoices);

        // assert
        expect(criterions.filter((x) => x.failure).length).toBe(1);
        expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
            failure: true,
            notice: { errorCode: SlotNoticeHelper.invalidPaylines },
        });
    });
});

describe("consume", () => {
    const currencyGroupGamesRepository = stubMongooseModelStupidly(mongoose.Model);
    const expectStakes = { stakeLevels: [{ stake: 0.1 }, { stake: 1 }, { stake: 5 }] };
    currencyGroupGamesRepository.findOne().lean().exec.mockReturnValue(expectStakes);

    it("should push payload into betQueue", async () => {
        // arrange
        const consumer = new PlaceBetConsumer(gameDefinition, stubGameData(), publisher, currencyGroupGamesRepository);
        const player = stubPlayer();
        const payload = stubPayload();

        // act
        await consumer.consume(player, payload);

        // assert
        expect(consumer.gameData.ingame[player.profile.name].betQueue).not.toBeEmpty();
    });

    it("should NOT push payload into betQueue if invalid bet", async () => {
        // arrange
        const consumer = new PlaceBetConsumer(gameDefinition, stubGameData(), publisher, currencyGroupGamesRepository);

        const player = stubPlayer();
        const payload = stubPayload(1.5);

        // act
        await consumer.consume(player, payload);

        // assert
        expect(consumer.gameData.ingame[player.profile.name]).toBeUndefined();
    });

    it("betQueue should be doubled if it already contains once", async () => {
        // arrange
        const consumer = new PlaceBetConsumer(gameDefinition, stubGameData(), publisher, currencyGroupGamesRepository);
        const player = stubPlayer();
        const payload = stubPayload(1);

        // act
        await consumer.consume(player, payload);
        await consumer.consume(player, payload);

        // assert
        expect(consumer.gameData.ingame[player.profile.name].betQueue.length).toBe(2);
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
            currency: "US",
        },
    };
}

function stubPayload(amount = 1, freeSpin = null) {
    return {
        amount,
        betChoice: [1, 2, 3],
        freeSpin,
    };
}
