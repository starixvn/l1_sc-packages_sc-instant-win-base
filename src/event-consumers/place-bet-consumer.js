import math from "lodash/math";
import { helpers } from "sc-common";
import { Core } from "sc-game-base";
import defaultDefinition from "../board/default-definition";
import { MultipleCurrencyHelper } from "./../helpers";
import SlotNoticeHelper from "./../helpers/slot-notice-helper";

export default class PlaceBetConsumer extends Core.BaseEventConsumers.PlaceBetConsumer {
    constructor(definition, gameData, publisher, logService, boardDefinition) {
        super(definition, gameData, publisher, logService);
        this.boardDefinition = boardDefinition ?? defaultDefinition;
    }

    composeBettingTimeValidationCriteria(roundId) {
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

    composeHedgeBetValidationCriteria(betChoice, player) {
        return [];
    }

    composePromotionValidationCriteria(player) {
        return [];
    }

    async consume(player, payload) {
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

        this.initializePlayerData(player, payload);
        this.adjustBetTracks(player.profile.name, payload);
        this.gameData.ingame[name].betQueue.push({ player, payload });
    }

    initializePlayerData(player, payload) {
        const name = player.profile.name;

        if (!this.gameData.ingame[name]) {
            const newPlayer = {
                name: player.profile.name,
                avatarId: player.profile.avatarId,
                currency: player.session.currencyName,
                system: player.session.system,
                betTracks: {},
                betQueue: [],
                clientSeed: payload.clientSeed,
                operatorId: player.session.operatorId,
            };

            if (player.promotion) {
                newPlayer.promotion = { ...player.promotion };
            }

            this.gameData.ingame[name] = newPlayer;
        }
    }
}
