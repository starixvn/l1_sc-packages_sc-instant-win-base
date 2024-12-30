import { stub } from "jest-micro-auto-stub";
import { helpers } from "sc-common";
import { BaseEventPublishers } from "sc-game-base/src/core";

import SlotNoticeHelper from "../../helpers/slot-notice-helper";
import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";
import PlaceBetConsumer from "../place-bet-consumer";

describe("PlaceBetConsumer", () => {
    const gameData = stubGameData();
    const gameDefinition = stubGameDefinition();
    const publisher = stub(BaseEventPublishers);

    let placeBetConsumer;

    beforeEach(() => {
        placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData, publisher);
    });

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
        describe("when amount is NOT valid bet level", () => {
            it("should return invalidStakeLevel when amount is 0", () => {
                // arrange
                const amount = 0;

                // act
                const criterions = placeBetConsumer.composeBetAmountValidationCriteria(
                    { session: { currencyGroupId: "617a650628b7a500016388f5" } },
                    {},
                    amount,
                    false
                );

                // assert
                expect(criterions.filter((x) => x.failure).length).toBe(2);
                expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
                    failure: true,
                    notice: { errorCode: SlotNoticeHelper.invalidStakeLevel },
                });
            });

            it("should return invalidStakeLevel when amount is less than 0", () => {
                // arrange
                const amount = -1;

                // act
                const criterions = placeBetConsumer.composeBetAmountValidationCriteria({ session: {} }, {}, amount, false);

                // assert
                expect(criterions.filter((x) => x.failure).length).toBe(2);
                expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
                    failure: true,
                    notice: { errorCode: SlotNoticeHelper.invalidStakeLevel },
                });
            });

            it("should return invalidStakeLevel when amount is not belongs to stake level configurations", () => {
                // arrange
                const amount = 2;

                // act
                const criterions = placeBetConsumer.composeBetAmountValidationCriteria(
                    { session: { currencyGroupId: "617a650628b7a500016388f5" } },
                    {},
                    amount,
                    false
                );

                // assert
                expect(criterions.filter((x) => x.failure).length).toBe(1);
                expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
                    failure: true,
                    notice: { errorCode: SlotNoticeHelper.invalidStakeLevel },
                });
            });
        });

        describe("when amount is valid bet level", () => {
            it("should return empty array", () => {
                // arrange
                const amount = 1;

                // act
                const criterions = placeBetConsumer.composeBetAmountValidationCriteria(
                    { session: { currencyGroupId: "617a650628b7a500016388f5" } },
                    {},
                    amount,
                    {}
                );

                // assert
                expect(criterions.filter((criteria) => criteria.failure)).toBeEmpty();
            });
        });
    });

    describe("consume", () => {
        beforeEach(() => {
            gameData.gameConfigs.enabled = true;
            gameData.ingame = {};
        });

        it("should assign 25 paylines to betChoice", () => {
            // arrange
            const player = stubPlayer();
            const payload = stubPayload();

            // act
            placeBetConsumer.consume(player, payload);
            const { betQueue } = placeBetConsumer.gameData.ingame[player.profile.name];
            const betInfo = betQueue[0].payload;

            // assert
            expect(betInfo.betChoice).toBeArrayOfSize(25);
        });

        it("should push payload into betQueue", () => {
            // arrange
            const player = stubPlayer();
            const payload = stubPayload();

            // act
            placeBetConsumer.consume(player, payload);

            // assert
            expect(placeBetConsumer.gameData.ingame[player.profile.name].betQueue).not.toBeEmpty();
        });

        it("should NOT push payload into betQueue if invalid bet", () => {
            // arrange
            const player = stubPlayer();
            const payload = stubPayload(1);

            // act
            placeBetConsumer.consume(player, payload);

            // assert
            expect(placeBetConsumer.gameData.ingame[player.profile.name]).toBeUndefined();
        });
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
            betLevels: [0.1, 1, 5],
        },
    };

    gameData.currencyGroupGames = [{ groupId: "617a650628b7a500016388f5", betLevels: [0.1, 1, 5] }];
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
            currencyGroupId: "617a650628b7a500016388f5",
        },
    };
}

function stubPayload(amount = 2.5, freeSpin = null) {
    return {
        amount,
        freeSpin,
    };
}
