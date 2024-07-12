import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
import defaultDefinition from "./../board/default-definition";

import { BoardGenerator, BonusBoardGenerator, JackpotPrizeGenerator, PaylineCalculator } from "./../board";
import BoardCheatingConsumer from "./board-cheating-consumer";

export default class GenerateResultConsumer {
    /**
     * @param {Object} dependencies
     * @param {SlotGameDefinition} dependencies.definition
     * @param {SlotGameData} dependencies.gameData
     * @param {BoardGenerator} dependencies.boardGenerator
     * @param {BonusBoardGenerator} dependencies.bonusBoardGenerator
     * @param {PaylineCalculator} dependencies.paylineCalculator
     * @param {BoardCheatingConsumer} dependencies.boardCheatingConsumer
     */

    constructor({ definition, gameData, boardGenerator, bonusBoardGenerator, paylineCalculator, boardCheatingConsumer, boardDefinition }) {
        this.definition = definition;
        this.gameData = gameData;
        this.boardCheatingConsumer = boardCheatingConsumer;
        this.boardGenerator = boardGenerator;
        this.bonusBoardGenerator = bonusBoardGenerator;
        this.paylineCalculator = paylineCalculator;
        this.boardDefinition = boardDefinition ?? defaultDefinition;
    }

    generateSettlementResult(bet, odds) {
        const result = this.generateResult(bet.name);
        const settlementResult = this.paylineCalculator.calculate(result, bet.paylines, odds);
        settlementResult.winningPaylines = this.settleWinningPaylines(settlementResult);

        return { result, settlementResult };
    }

    generateResult(playerName) {
        const { mode } = this.gameData.gameConfigs.slotsConfig;
        const board = this.boardGenerator.generate(mode);

        return this.boardCheatingConsumer.consume(playerName, board);
    }

    settleWinningPaylines(settlementResult) {
        return settlementResult.jackpot
            ? settlementResult.paylines.filter((payline) => payline.odds > 0 && payline.payline !== settlementResult.jackpotPayline)
            : settlementResult.paylines.filter((payline) => payline.odds > 0);
    }

    generateBonus(bet, bonusConfig) {
        this.bonusBoardGenerator.generate(bet.bet, bonusConfig.min, bonusConfig.max, bet.paylines.length);
    }
}
