import _ from "lodash";
import { helpers, logger } from "sc-common";
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

        logger.logWarning(`Received bet for ${player.profile.name}. Current bet with roundId ${finish.roundId} is processing...`);
        super.consume(player, payload);
    }

    validateBetRequest(player, betChoice, amount, freeBet) {
        logger.logWarning(`Validating bet for ${player.profile.name}. Bet amount ${amount} and choices ${betChoice}`);

        if (!amount || !betChoice) {
            logger.logWarning(`Validating bet FAILED for ${player.profile.name} for amount and choice.`);
            return false;
        }

        const criteria = this.composeValidationCriteria(player, betChoice, amount, freeBet);
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            logger.logWarning(`Validating bet FAILED for ${player.profile.name}: ${failedCriterion.notice}.`);
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: failedCriterion.notice });

            return false;
        }

        return true;
    }

    adjustBetTracks(playerName, bet) {}
}
