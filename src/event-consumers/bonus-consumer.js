import Chance from "chance";
import moment from "moment";
import { Core } from "sc-game-base";

import { BonusPublisher } from "./../event-publishers";
import SlotNoticeHelper from "./../helpers/slot-notice-helper";
import SettleGameRoundConsumer from "./settle-game-round-consumer";

export default class BonusConsumer {
    /**
     * @param {Core.GameDefinition} definition
     * @param {Core.GameData} gameData
     * @param {BonusPublisher} bonusPublisher
     * @param {SettleGameRoundConsumer} settleRoundConsumer
     */
    constructor(definition, gameData, bonusPublisher = null, settleRoundConsumer = null) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = bonusPublisher ?? new BonusPublisher(definition.name, gameData);
        this.settleRoundConsumer = settleRoundConsumer ?? new SettleGameRoundConsumer({ definition, gameData });
        this.chance = new Chance();
    }

    async consume(player, payload) {
        const { chest } = payload;

        if (!this.validate(player, chest)) {
            return;
        }

        const { bonusChests, finish } = this.gameData.ingame[player.profile.name];
        bonusChests[chest].picked = true;

        this.publisher.publishBonus(player.UID, { chest, amount: bonusChests[chest].amount });

        if (bonusChests.filter((chest) => chest.picked).length === finish.settlementResult.bonus) {
            await this.settleRoundConsumer.settleRound(player, finish.roundId);
        }
    }

    getUnpickedChests(playerName) {
        const { bonusChests } = this.gameData.ingame[playerName];

        return bonusChests.filter((chest) => !chest.picked);
    }

    async autoOpenRemainingChests(player) {
        const { finish } = this.gameData.ingame[player.profile.name];
        const unpickedChests = this.getUnpickedChests(player.profile.name);
        const remainingChests = finish.settlementResult.bonus.odds - (this.definition.bonusSize - unpickedChests.length);

        const autoPickedChests = this.chance.pickset(unpickedChests, remainingChests);

        autoPickedChests.forEach((chest) => {
            chest.picked = true;
        });

        return this.settleRoundConsumer.settleRound(player, finish.roundId);
    }

    async processExpiredBonus() {
        const expiryTime = moment.utc().subtract(this.definition.bonusLiveSeconds, "seconds").toDate();
        const bets = Object.values(this.gameData.ingame).filter((currentBet) => currentBet.finish.time < expiryTime);

        await Promise.all(
            bets.map(async (bet) => {
                const { bonusChests, finish } = bet;

                this.gameData.ingame[bet.name].finish = finish;
                this.gameData.ingame[bet.name].bonusChests = bonusChests;

                await this.autoOpenRemainingChests(bet.player);
            })
        );
    }

    validate(player, chest) {
        const { bonusChests } = this.gameData.ingame[player.profile.name];
        const criteria = [
            {
                failure: !chest || chest < 0 || chest > this.definition.bonusSize,
                notice: SlotNoticeHelper.invalidBonus,
            },
            {
                failure: bonusChests[chest].picked,
                notice: SlotNoticeHelper.openedBonus,
            },
        ];

        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.publisher.publishToUser(player.UID, { endBet: -1, notice: failedCriterion.notice });

            return false;
        }

        return true;
    }
}
