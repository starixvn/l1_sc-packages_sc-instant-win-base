import { Core } from "sc-game-base";

import BonusPublisher from "./../publishers/bonus-publisher";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class BonusConsumer {
    /**
     * @param {Core.GameDefinition} definition
     * @param {Core.GameData} gameData
     * @param {BonusPublisher} bonusPublisher
     */
    constructor(definition, gameData, bonusPublisher = null) {
        this.definition = definition;
        this.gameData = gameData;
        this.publisher = bonusPublisher ?? new BonusPublisher(definition.name, gameData);
    }

    consume(player, payload) {
        const { chest } = payload;

        if (!this.validate(player, chest)) {
            return;
        }

        const { bonusChests, settlementResult } = this.gameData.ingame[player.profile.name];
        bonusChests[chest].picked = true;

        this.publisher.publishBonus(player.UID, { chest, amount: bonusChests[chest].amount });

        if (bonusChests.filter((chest) => chest.picked).length === settlementResult.bonus) {
            //TODO auto settle
        }
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
