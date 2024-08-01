import Chance from "chance";

import JackpotValidator from "../validators/jackpot-validator";
import SlotGameDefinition from "./../slot-game-definition";

export default class JackpotPrizeGenerator {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {JackpotValidator} jackpotValidator
     */
    constructor(definition, gameData, jackpotValidator) {
        this.definition = definition;
        this.gameData = gameData;
        this.size = definition.jackpotSize ?? 10;
        this.jackpotValidator = jackpotValidator;

        this.chance = new Chance();
    }

    generate(player) {
        if (!this.jackpotValidator.canHitJackpot(player)) {
            return [];
        }

        const { pools } = this.gameData.gameConfigs.slotsConfig.jackpot;
        const prizes = Object.keys(pools);
        const weights = Object.values(pools).map((pool) => pool.playerSettings.alloc);

        let jackpotBoard = [];

        for (let counter = 0; counter < this.size; counter++) {
            jackpotBoard.push(this.chance.weighted(prizes, weights));
        }

        jackpotBoard = this.chance.shuffle(jackpotBoard);
        jackpotBoard = this.chance.shuffle(jackpotBoard);
        jackpotBoard = this.chance.shuffle(jackpotBoard);

        return jackpotBoard;
    }
}
