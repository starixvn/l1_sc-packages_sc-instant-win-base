import { helpers } from "sc-common";
import { Core } from "sc-game-base";

import SlotNoticeHelper from "./../helpers/slot-notice-helper";
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
        const gameConfigs = this.gameData.gameConfigs;

        return [
            {
                failure: !gameConfigs.enabled,
                notice: helpers.noticeHelper.placeBetNextRound,
            },
        ];
    }

    composeBetAmountValidationCriteria(player, betChoice, amount, freeBet) {
        const stakeLevels = this.gameData.gameConfigs.slotsConfig?.stakeLevels ?? [];

        return [
            {
                failure: !stakeLevels.find((stakeLevel) => stakeLevel.stake === amount),
                notice: SlotNoticeHelper.invalidStakeLevel,
            },
        ];
    }

    composeBetChoiceValidationCriteria(betChoice) {
        return [
            {
                failure: betChoice.length < 1,
                notice: SlotNoticeHelper.invalidPaylines,
            },
            {
                failure: betChoice.filter((choice) => !this.definition.choices.includes(choice)).length > 0,
                notice: SlotNoticeHelper.invalidPaylines,
            },
        ];
    }
}
