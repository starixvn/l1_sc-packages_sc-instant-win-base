import _ from "lodash";
import { helpers } from "sc-common";
import { Core } from "sc-game-base";

import SlotNoticeHelper from "./../helpers/slot-notice-helper";

export default class PlaceBetConsumer extends Core.BaseEventConsumers.PlaceBetConsumer {
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
                failure: betChoice.length < 1 || betChoice.length > this.definition.choices.length,
                notice: SlotNoticeHelper.invalidPaylines,
            },
            {
                failure: betChoice.filter((choice) => !this.definition.choices.includes(choice)).length > 0,
                notice: SlotNoticeHelper.invalidPaylines,
            },
            {
                failure: _.uniq(betChoice).length !== betChoice.length,
                notice: SlotNoticeHelper.invalidPaylines,
            },
        ];
    }

    consume(player, payload) {
        payload.freeSpin = payload.freeSpin ?? false;
        super.consume(player, payload);
    }

    adjustBetTracks(playerName, bet) {}
}
