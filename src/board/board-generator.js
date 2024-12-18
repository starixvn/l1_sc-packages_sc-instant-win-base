import Chance from "chance";
import defaultDefinition from "./default-definition";
import difficulties from "./difficulties";
export default class BoardGenerator {
    /**
     * @param {defaultDefinition} boardDefinition
     */
    constructor(boardDefinition, gameData) {
        this.chance = new Chance();
        this.definition = boardDefinition ?? defaultDefinition;
        this.numberOfPaylines = this.definition.paylines.length;

        this.gameData = gameData;
    }

    generate(difficulty) {
        const { slotsConfig } = this.gameData.gameConfigs;
        return this.generateByStrategy(slotsConfig.symbolWeight?.[difficulty] ?? this.getFillingStrategy(difficulty));
    }

    generateForBots(isJackpotEnabled, botRatio = 40) {
        const maxJackpotPossibility = Math.round(this.definition.fillingStrategyForBots.jackpotPossibilityRange / botRatio);
        const jackpotPossibility = this.chance.natural({ min: 0, max: maxJackpotPossibility });

        const fillingStrategy =
            jackpotPossibility === maxJackpotPossibility && isJackpotEnabled
                ? this.definition.fillingStrategyForBots.jackpot
                : this.definition.fillingStrategyForBots.normal;
        return this.generateByStrategy(fillingStrategy);
    }

    generateByStrategy(fillingStrategy) {
        const board = [];

        for (const rowWeight of fillingStrategy) {
            const filledSymbols = rowWeight.reduce((result, repeat, symbol) => result.concat(Array(repeat).fill(symbol)), []);
            board.push(...this.chance.pickset(filledSymbols, this.definition.numberOfColumns));
        }
        return this.shuffle(board);
    }

    shuffle(board, times = 3) {
        let shuffledBoard;
        for (let time = 0; time < times; time++) {
            shuffledBoard = this.chance.shuffle(board);
        }

        return shuffledBoard;
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
