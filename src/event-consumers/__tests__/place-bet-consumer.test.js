import { helpers } from "sc-common";

import SlotNoticeHelper from "../../helpers/slot-notice-helper";
import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";
import PlaceBetConsumer from "../place-bet-consumer";

const gameData = mockGameData();
const gameDefinition = mockGameDefinition();

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
    it("should return invalidStakeLevel when amount is 0", () => {
        // arrange
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData);
        const amount = 0;

        // act
        const criterions = placeBetConsumer.composeBetAmountValidationCriteria({}, {}, amount, {});

        // assert
        expect(criterions.filter((x) => x.failure).length).toBe(2);
        expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
            failure: true,
            notice: { errorCode: SlotNoticeHelper.invalidStakeLevel },
        });
    });

    it("should return invalidStakeLevel when amount is less than 0", () => {
        // arrange
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData);
        const amount = -1;

        // act
        const criterions = placeBetConsumer.composeBetAmountValidationCriteria({}, {}, amount, {});

        // assert
        expect(criterions.filter((x) => x.failure).length).toBe(2);
        expect(criterions.filter((x) => x.failure)[0]).toStrictEqual({
            failure: true,
            notice: { errorCode: SlotNoticeHelper.invalidStakeLevel },
        });
    });

    it("should return invalidStakeLevel when amount is not belongs to stake level configurations", () => {
        // arrange
        const placeBetConsumer = new PlaceBetConsumer(gameDefinition, gameData);
        const amount = 2;

        // act
        const criterions = placeBetConsumer.composeBetAmountValidationCriteria({}, {}, amount, {});

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
});

function mockGameData() {
    const gameData = new SlotGameData();

    gameData.remainingTime = 20;
    gameData.gameConfigs = {
        enabled: true,
        minbet: 1,
        maxbet: 1000,
        slotsConfig: {
            stakeLvels: [0.1, 1, 5],
        },
    };

    return gameData;
}

function mockGameDefinition() {
    return new SlotGameDefinition({
        choices: [1, 2, 3, 4, 5],
    });
}
