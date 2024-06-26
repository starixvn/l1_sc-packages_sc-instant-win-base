import Chance from "chance";

import SlotGameDefinition from "./../slot-game-definition";

export default class JackpotPrizeGenerator {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     */

    //TODO use prize weights configuration to generate
    constructor(definition, gameData) {
        this.definition = definition;
        this.gameData = gameData;
        this.size = definition.jackpotSize ?? 6;

        this.chance = new Chance();
    }

    generate() {
        const { pools } = this.gameData.gameConfigs.slotsConfig.jackpot;
        const prizes = Object.keys(pools);
        const prizeWeights = this.generateWeights(prizes);
        const weights = prizes.map((prize) => prizeWeights[prize].weight);

        let jackpotBoard = [];

        for (let counter = 0; counter < this.size; counter++) {
            const jackpot = { prize: this.chance.weighted(prizes, weights) };

            jackpotBoard.push(jackpot);
        }

        jackpotBoard = this.chance.shuffle(jackpotBoard);
        jackpotBoard = this.chance.shuffle(jackpotBoard);
        jackpotBoard = this.chance.shuffle(jackpotBoard);

        return jackpotBoard;
    }

    generateWeights(prizes) {
        const weights = {};

        prizes.forEach((prize) => {
            weights[prize] = { weight: 1 };
        });

        return weights;
    }
}
