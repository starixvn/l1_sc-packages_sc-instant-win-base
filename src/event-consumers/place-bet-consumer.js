import _ from "lodash";
import { helpers } from "sc-common";
import { Core } from "sc-game-base";

import SlotNoticeHelper from "./../helpers/slot-notice-helper";
import { MultipleCurrencyHelper } from "./../helpers";

export default class PlaceBetConsumer extends Core.BaseEventConsumers.PlaceBetConsumer {
    composeBettingTimeValidationCriteria() {
        const gameConfigs = this.gameData.gameConfigs;

        return [
            {
                failure: !gameConfigs.enabled,
                notice: this.getNoticeObj(helpers.noticeHelper.placeBetNextRound),
            },
        ];
    }

    composeBetAmountValidationCriteria(player, betChoice, amount, freeBet) {
        const stakeLevels = MultipleCurrencyHelper.getStakeLevels(this.gameData, player);

        return [
            {
                failure: amount <= 0,
                notice: this.getNoticeObj(SlotNoticeHelper.invalidStakeLevel),
            },
            {
                failure: !stakeLevels.find((stakeLevel) => stakeLevel.stake === amount),
                notice: this.getNoticeObj(SlotNoticeHelper.invalidStakeLevel),
            },
        ];
    }

    composeBetChoiceValidationCriteria(betChoice) {
        return [
            {
                failure: betChoice.length < 1,
                notice: this.getNoticeObj(SlotNoticeHelper.invalidPaylines),
            },
            {
                failure: betChoice.filter((choice) => !this.definition.choices.includes(choice)).length > 0,
                notice: this.getNoticeObj(SlotNoticeHelper.invalidPaylines),
            },
            {
                failure: _.uniq(betChoice).length !== betChoice.length,
                notice: this.getNoticeObj(SlotNoticeHelper.invalidPaylines),
            },
        ];
    }

    consume(player, payload) {
        Object.assign(payload, {
            amount: payload.amount,
            freeBet: payload.freeBet ?? false,
            freeSpin: payload.freeSpin ?? false,
        });

        const { amount, betChoice, freeBet, roundId } = payload;
        const name = player.profile.name;

        if (!this.validateBetRequest(player, betChoice, amount, freeBet, roundId)) {
            return;
        }

        if (!this.gameData.ingame[name]) {
            const newPlayer = {
                name: player.profile.name,
                currency: player.session.currencyName,
                betTracks: {},
                betQueue: [],
                operatorId: player.session.operatorId,
            };

            this.gameData.ingame[name] = newPlayer;
        }

        this.gameData.ingame[name].betQueue.push({ player, payload });
    }
}
