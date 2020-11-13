import Chance from "chance";

import defaultDefinition from "./default-definition";
import difficulties from "./difficulties";

export default class BoardGenerator {
    constructor(definition) {
        this.chance = new Chance();
        this.definition = definition ?? defaultDefinition;

        this.lowPrizedSymbolPosibilityGap = Object.keys(this.definition.specialSymbols).length;

        this.anySymbolPosibilities = this.buildAnySymbolPosibilities();
        this.lowPrizedSymbolPosibilities = this.buildLowPrizedSymbolPosibilities();
    }

    buildAnySymbolPosibilities() {
        const posibilityRange = this.definition.numberOfSymbols;

        return this.buildSymbolPosibilities(posibilityRange);
    }

    buildLowPrizedSymbolPosibilities() {
        const posibilityRange = this.definition.numberOfSymbols - this.lowPrizedSymbolPosibilityGap;

        return this.buildSymbolPosibilities(posibilityRange);
    }

    buildSymbolPosibilities(posibilityRange) {
        if (posibilityRange <= 0) {
            return [];
        }

        const posibilityMatrix = [];

        for (let symbol = 0; symbol < posibilityRange; symbol++) {
            const occurrences = posibilityRange - symbol;

            posibilityMatrix.push(...Array(occurrences).fill(symbol));
        }

        return posibilityMatrix;
    }

    generate(difficulty) {
        const fillingStratergy = this.getFillingStrategy(difficulty);
        const generatedBoard = this.generateByStratergy(fillingStratergy);
        let shuffledBoard = generatedBoard;

        shuffledBoard = this.chance.shuffle(shuffledBoard);
        shuffledBoard = this.chance.shuffle(shuffledBoard);
        shuffledBoard = this.chance.shuffle(shuffledBoard);

        return shuffledBoard;
    }

    generateForBots() {
        const maxJackpotPosibility = this.definition.fillingStratergyForBots.jackpotPosibilityRange - 1;
        const jackpotPosibility = this.chance.natural({ min: 0, max: maxJackpotPosibility });
        const fillingStratergy =
            jackpotPosibility === maxJackpotPosibility
                ? this.definition.fillingStratergyForBots.jackpot
                : this.definition.fillingStratergyForBots.normal;
        const generatedBoard = this.generateByStratergy(fillingStratergy);

        return this.chance.shuffle(generatedBoard);
    }

    generateByStratergy(fillingStratergy) {
        const generatedBoard = [];

        fillingStratergy.forEach((literal) => {
            const newSymbol = typeof literal === "string" ? this[literal]?.() : literal;

            generatedBoard.push(newSymbol);
        });

        return generatedBoard;
    }

    randomAnySymbol() {
        const posibility = this.chance.natural({ min: 0, max: this.anySymbolPosibilities.length - 1 });

        return this.anySymbolPosibilities[posibility];
    }

    randomLowPrizedSymbol() {
        const posibility = this.chance.natural({ min: 0, max: this.lowPrizedSymbolPosibilities.length - 1 });

        return this.lowPrizedSymbolPosibilities[posibility];
    }

    randomSpecialSymbol() {
        const posibility = this.chance.natural({ min: 0, max: 1 });

        return posibility === 0 ? this.definition.specialSymbols.bonus : this.definition.specialSymbols.freeSpins;
    }

    getFillingStrategy(difficulty) {
        switch (difficulty) {
            case difficulties.hard:
                return this.definition.fillingStratergies.hard;
            case difficulties.medium:
                return this.definition.fillingStratergies.medium;
            default:
                return this.definition.fillingStratergies.easy;
        }
    }
}
