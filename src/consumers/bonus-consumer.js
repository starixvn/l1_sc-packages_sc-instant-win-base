import Chance from "chance";
import { Core } from "sc-game-base";

import BonusPublisher from "./../publishers/bonus-publisher";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
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

    consume(player, payload) {
        const { chest } = payload;

        if (!this.validate(player, chest)) {
            return;
        }

        const { bonusChests } = this.gameData.ingame[player.profile.name];
        bonusChests[chest].picked = true;

        this.publisher.publishBonus(player.UID, { chest, amount: bonusChests[chest].amount });

        if (bonusChests.filter((chest) => chest.picked).length === this.gameData.ingame[player.profile.name].finish.settlementResult.bonus) {
            this.settleRoundConsumer.settleRoundWithBonus(player);
        }
    }

    getUnpickedChests(playerName) {
        const { bonusChests } = this.gameData.ingame[playerName];

        return bonusChests.filter((chest) => !chest.picked);
    }

    async autoOpenRemaningChests(player) {
        const { settlementResult } = this.gameData.ingame[player.profile.name];
        const unpickedChests = this.getUnpickedChests(player.profile.name);
        const remainingChests = settlementResult.bonus - (this.definition.bonusSize - unpickedChests.length);

        const autoPickedChests = this.chance.pickset(unpickedChests, remainingChests);

        autoPickedChests.forEach((chest) => {
            chest.picked = true;
        });

        return this.settleRoundConsumer.settleRoundWithBonus(player);
    }

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
