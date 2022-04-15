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

    generate(betAmount, minRate, maxRate, numberOfPaylines) {
        let bonusBoard = [];

        for (let counter = 0; counter < this.size; counter++) {
            const bonusRate = this.chance.natural(this.calculateBonusRateRange(minRate, maxRate, numberOfPaylines));
            const amount = parseFloat((bonusRate * betAmount).toFixed(2));
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
        const totalPaylines = 25;

        const min = Math.max((minRate / totalPaylines) * paylinesRate, 1);
        const max = Math.max((maxRate / totalPaylines) * paylinesRate, 3);

        return { min: Math.floor(parseFloat(min.toFixed(2))), max: Math.floor(parseFloat(max.toFixed(2))) };
    }
}
