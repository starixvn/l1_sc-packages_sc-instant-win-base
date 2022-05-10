import Chance from "chance";

import defaultDefinition from "./default-definition";
import difficulties from "./difficulties";

export default class BoardGenerator {
    /**
     * @param {defaultDefinition} boardDefinition
     */
    constructor(boardDefinition) {
        this.chance = new Chance();
        this.definition = boardDefinition ?? defaultDefinition;
        this.numberOfPaylines = this.definition.paylines.length;

        this.lowPrizedSymbolPossibilityGap = Object.keys(this.definition.specialSymbols).length;

        this.anySymbolPossibilities = this.buildAnySymbolPossibilities();
        this.lowPrizedSymbolPossibilities = this.buildLowPrizedSymbolPossibilities();
    }

    buildAnySymbolPossibilities() {
        const possibilityRange = this.definition.numberOfSymbols;

        return this.buildSymbolPossibilities(possibilityRange);
    }

    buildLowPrizedSymbolPossibilities() {
        const possibilityRange = this.definition.numberOfSymbols - this.lowPrizedSymbolPossibilityGap;

        return this.buildSymbolPossibilities(possibilityRange);
    }

    buildSymbolPossibilities(possibilityRange) {
        if (possibilityRange <= 0) {
            return [];
        }

        const possibilityMatrix = [];

        for (let symbol = 0; symbol < possibilityRange; symbol++) {
            const occurrences = possibilityRange - symbol;

            possibilityMatrix.push(...Array(occurrences).fill(symbol));
        }

        return possibilityMatrix;
    }

    generate(difficulty) {
        const fillingStrategy = this.getFillingStrategy(difficulty);
        const generatedBoard = this.generateByStrategy(fillingStrategy);
        let shuffledBoard = generatedBoard;

        shuffledBoard = this.chance.shuffle(shuffledBoard);
        shuffledBoard = this.chance.shuffle(shuffledBoard);
        shuffledBoard = this.chance.shuffle(shuffledBoard);

        return shuffledBoard;
    }

    generateForBots(isJackpotEnabled, botRatio = 1) {
        const maxJackpotPossibility = Math.round(this.definition.fillingStrategyForBots.jackpotPossibilityRange / botRatio);
        const jackpotPossibility = this.chance.natural({ min: 0, max: maxJackpotPossibility });

        const fillingStrategy =
            jackpotPossibility === maxJackpotPossibility && isJackpotEnabled
                ? this.definition.fillingStrategyForBots.jackpot
                : this.definition.fillingStrategyForBots.normal;
        const generatedBoard = this.generateByStrategy(fillingStrategy);

        return this.chance.shuffle(generatedBoard);
    }

    generateByStrategy(fillingStrategy) {
        const generatedBoard = [];

        fillingStrategy.forEach((literal) => {
            const newSymbol = typeof literal === "string" ? this[literal]?.() : literal;

            generatedBoard.push(newSymbol);
        });

        return generatedBoard;
    }

    randomAnySymbol() {
        const possibility = this.chance.natural({ min: 0, max: this.anySymbolPossibilities.length - 1 });

        return this.anySymbolPossibilities[possibility];
    }

    randomLowPrizedSymbol() {
        const possibility = this.chance.natural({ min: 0, max: this.lowPrizedSymbolPossibilities.length - 1 });

        return this.lowPrizedSymbolPossibilities[possibility];
    }

    randomSpecialSymbol() {
        const possibility = this.chance.natural({ min: 0, max: 1 });

        return possibility === 0 ? this.definition.specialSymbols.bonus : this.definition.specialSymbols.freeSpins;
    }

    getFillingStrategy(difficulty) {
        switch (difficulty) {
            case difficulties.hard:
                return this.definition.fillingStrategies.hard;
            case difficulties.medium:
                return this.definition.fillingStrategies.medium;
            default:
                return this.definition.fillingStrategies.easy;
        }
    }
}
