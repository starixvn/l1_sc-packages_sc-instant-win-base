import Chance from "chance";

export default class BonusBoardGenerator {
    constructor({ size, minRate, maxRate }) {
        this.chance = new Chance();

        this.size = size;
        this.minRate = minRate;
        this.maxRate = maxRate;
    }

    generate(betAmount) {
        let bonusBoard = [];

        for (let counter = 0; counter < this.size; counter++) {
            const bonusRate = this.chance.natural({ min: this.minRate, max: this.maxRate });
            const bonus = { amount: bonusRate * betAmount, picked: false };

            bonusBoard.push(bonus);
        }

        bonusBoard = this.chance.shuffle(bonusBoard);
        bonusBoard = this.chance.shuffle(bonusBoard);
        bonusBoard = this.chance.shuffle(bonusBoard);

        return bonusBoard;
    }
}
