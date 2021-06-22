import { helpers } from "sc-common";

import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";
import PlaceBetConsumer from "../place-bet-consumer";

const gameData = mockGameData();
const gameDefinition = mockGameDefinition();

describe("composeBettingTimeValidationCriteria", () => {
    it("should return placeBetNextRound when game was disabled", () => {
        // arrange'
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

function mockGameData() {
    const gameData = new SlotGameData();

    gameData.remainingTime = 20;
    gameData.gameConfigs = {
        enabled: true,
        minbet: 1,
        maxbet: 1000,
        choices_maxbet: {
            choice01: 200,
        },
    };

    return gameData;
}

function mockGameDefinition() {
    return new SlotGameDefinition({
        choices: ["choice01"],
    });
}
