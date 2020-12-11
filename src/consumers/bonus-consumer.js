import Chance from "chance";
import { Core } from "sc-game-base";

import BonusPublisher from "./../publishers/bonus-publisher";
import SettleGameRoundConsumer from "./settle-game-round-consumer";

export default class BonusConsumer {
    /**
     * @param {Core.GameDefinition} definition
     * @param {Core.GameData} gameData
     * @param {BonusPublisher} bonusPublisher
     */
    constructor(definition, gameData, bonusPublisher = null, settleRoundConsumer = null) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = bonusPublisher ?? new BonusPublisher(definition.name, gameData);
        this.settleRoundConsumer = settleRoundConsumer ?? new SettleGameRoundConsumer(definition, gameData);
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
            return this.settleRoundConsumer.settleRound(player, finish.roundId);
        }
    }

    getUnpickedChests(playerName) {
        const { bonusChests } = this.gameData.ingame[playerName];

        return bonusChests.filter((chest) => !chest.picked);
    }

    async autoOpenRemainingChests(player) {
        const { finish } = this.gameData.ingame[player.profile.name];
        const unpickedChests = this.getUnpickedChests(player.profile.name);
        const remainingChests = finish.settlementResult.bonus - (this.definition.bonusSize - unpickedChests.length);

        const autoPickedChests = this.chance.pickset(unpickedChests, remainingChests);

        autoPickedChests.forEach((chest) => {
            chest.picked = true;
        });

        return this.settleRoundConsumer.settleRound(player, finish.roundId);
    }

    //TODO move validate message to common?
    validate(player, chest) {
        const { bonusChests } = this.gameData.ingame[player.profile.name];
        const criteria = [
            {
                failure: !chest || chest < 0 || chest > this.definition.bonusSize,
                notice: "Invalid bonus chest",
            },
            {
                failure: bonusChests[chest].picked,
                notice: "Chest opened",
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
