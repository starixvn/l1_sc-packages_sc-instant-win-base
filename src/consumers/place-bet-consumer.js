import { helpers } from "sc-common";
import { Core } from "sc-game-base";

import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class PlaceBetConsumer extends Core.BaseEventConsumers.PlaceBetConsumer {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {Core.BaseEventPublishers.BasePublisher} publisher
     */

    constructor(definition, gameData, publisher = null) {
        super(definition, gameData, publisher);
    }

    composeBettingTimeValidationCriteria() {
        const configs = this.gameData.gameConfigs;

        return [
            {
                failure: !configs.enabled,
                notice: helpers.noticeHelper.placeBetNextRound,
            },
        ];
    }

    composeBetAmountValidationCriteria(player, betChoice, amount, freeBet) {
        return [
            {
                failure: !this.definition.stakeLevels.includes(amount),
                notice: helpers.noticeHelper.placeBetNextRound,
            },
        ];
    }
}
