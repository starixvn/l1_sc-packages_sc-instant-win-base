import Chance from "chance";

import SlotGameDefinition from "./../slot-game-definition";
import defaultDefinition from "./default-definition";

export default class BonusBoardGenerator {
    /**
     * @param {SlotGameDefinition} definition
     * @param {defaultDefinition} boardDefinition
     */
    constructor(definition, boardDefinition) {
        this.chance = new Chance();
        this.size = definition.bonusSize;
        this.totalPaylines = (boardDefinition ?? defaultDefinition).paylines.length;
        this.applyNewBonusCalculation = definition.applyNewBonusCalculation;
    }

    generate(betAmount, minRate, maxRate, numberOfPaylines) {
        let bonusBoard = [];

        for (let counter = 0; counter < this.size; counter++) {
            const bonusRate = this.applyNewBonusCalculation
                ? this.chance.natural(this.calculateBonusRateRange(minRate, maxRate, numberOfPaylines))
                : this.chance.natural({ min: minRate, max: maxRate });

            const amount = parseFloat((bonusRate * betAmount).toFixed(4));
            const bonus = { amount, picked: false };

            bonusBoard.push(bonus);
        }

        bonusBoard = this.chance.shuffle(bonusBoard);
        bonusBoard = this.chance.shuffle(bonusBoard);
        bonusBoard = this.chance.shuffle(bonusBoard);

        return bonusBoard;
    }

    calculateBonusRateRange(minRate, maxRate, numberOfPaylines) {
        const paylinesRate = Math.max(numberOfPaylines - 2, 1);

        const min = Math.max((minRate / this.totalPaylines) * paylinesRate, 1);
        const max = Math.max((maxRate / this.totalPaylines) * paylinesRate, 3);

        return { min: Math.floor(parseFloat(min.toFixed(2))), max: Math.floor(parseFloat(max.toFixed(2))) };
    }
}
