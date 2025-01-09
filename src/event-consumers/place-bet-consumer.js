import math from "lodash/math";
import { helpers } from "sc-common";
import { Core } from "sc-game-base";
import defaultDefinition from "../board/default-definition";
import { MultipleCurrencyHelper } from "./../helpers";
import SlotNoticeHelper from "./../helpers/slot-notice-helper";

export default class PlaceBetConsumer extends Core.BaseEventConsumers.PlaceBetConsumer {
    constructor(definition, gameData, publisher, boardDefinition) {
        super(definition, gameData, publisher);
        this.boardDefinition = boardDefinition ?? defaultDefinition;
    }

    composeBettingTimeValidationCriteria() {
        const gameConfigs = this.gameData.gameConfigs;

        return [
            {
                failure: !gameConfigs.enabled,
                notice: this.getNoticeObj(helpers.noticeHelper.placeBetNextRound),
            },
        ];
    }

    composeBetAmountValidationCriteria(player, betChoice, amount, freeSpin) {
        const betLevels = MultipleCurrencyHelper.getBetLevels(this.gameData, player);

        return [
            {
                failure: amount <= 0,
                notice: this.getNoticeObj(SlotNoticeHelper.invalidStakeLevel),
            },
            {
                failure: !freeSpin && !betLevels.includes(amount),
                notice: this.getNoticeObj(SlotNoticeHelper.invalidStakeLevel),
            },
        ];
    }

    composeBetChoiceValidationCriteria(betChoice) {
        return [];
    }

    consume(player, payload) {
        Object.assign(payload, {
            amount: math.round(payload.amount / this.boardDefinition.paylines.length, 4),
            freeBet: payload.freeBet ?? false,
            freeSpin: payload.freeSpin ?? false,
            betChoice: Object.keys(this.boardDefinition.paylines),
        });

        const { amount, betChoice, freeSpin, roundId } = payload;
        const name = player.profile.name;

        if (!this.validateBetRequest(player, betChoice, amount, freeSpin, roundId)) {
            return;
        }

        if (!this.gameData.ingame[name]) {
            const newPlayer = {
                name: player.profile.name,
                avatarId: player.profile.avatarId,
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
