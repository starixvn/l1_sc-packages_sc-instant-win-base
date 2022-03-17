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

    generate(betAmount, noPaylines) {
        let bonusBoard = [];

        for (let counter = 0; counter < this.size; counter++) {
            const bonusRate = this.chance.natural(this.calculateBonusRateRange(noPaylines));
            const amount = parseFloat((bonusRate * betAmount).toFixed(2));
            const bonus = { amount, picked: false };

            bonusBoard.push(bonus);
        }

        bonusBoard = this.chance.shuffle(bonusBoard);
        bonusBoard = this.chance.shuffle(bonusBoard);
        bonusBoard = this.chance.shuffle(bonusBoard);

        return bonusBoard;
    }

    calculateBonusRateRange(noPaylines) {
        if (noPaylines <= 4) {
            return { min: 1, max: 3 };
        }

        if (noPaylines === 5) {
            return { min: 1, max: 3.36 };
        }

        const min = 0.32 * (noPaylines - 2);
        const max = 1.12 * (noPaylines - 2);

        return { min: parseFloat(min.toFixed(2)), max: parseFloat(max.toFixed(2)) };
    }
}
