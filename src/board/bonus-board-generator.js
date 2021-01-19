import Chance from "chance";

import SlotGameDefinition from "./../slot-game-definition";

export default class BonusBoardGenerator {
    /**
     * @param {SlotGameDefinition} definition
     */
    constructor(definition) {
        this.chance = new Chance();
        this.size = definition.bonusSize;
    }

    generate(betAmount, minRate, maxRate) {
        let bonusBoard = [];

        for (let counter = 0; counter < this.size; counter++) {
            const bonusRate = this.chance.natural({ min: minRate, max: maxRate });
            const bonus = { amount: bonusRate * betAmount, picked: false };

            bonusBoard.push(bonus);
        }

        bonusBoard = this.chance.shuffle(bonusBoard);
        bonusBoard = this.chance.shuffle(bonusBoard);
        bonusBoard = this.chance.shuffle(bonusBoard);

        return bonusBoard;
    }
}
