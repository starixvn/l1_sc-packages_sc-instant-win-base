import defaultDefinition from "./../board/default-definition";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
import { BoardGenerator, PaylineCalculator } from "./../board";
import BoardCheatingConsumer from "./board-cheating-consumer";

export default class GenerateResultConsumer {
    /**
     * @param {Object} dependencies
     * @param {SlotGameDefinition} dependencies.definition
     * @param {SlotGameData} dependencies.gameData
     * @param {BoardGenerator} dependencies.boardGenerator
     * @param {PaylineCalculator} dependencies.paylineCalculator
     * @param {BoardCheatingConsumer} dependencies.boardCheatingConsumer
     */
    constructor({ definition, gameData, boardGenerator, paylineCalculator, boardCheatingConsumer, boardDefinition }) {
        this.definition = definition;
        this.gameData = gameData;
        this.boardCheatingConsumer = boardCheatingConsumer;
        this.boardGenerator = boardGenerator;
        this.paylineCalculator = paylineCalculator;
        this.boardDefinition = boardDefinition ?? defaultDefinition;
    }

    generateSettlementResult(player, bet, odds) {
        const result = this.generateResult(bet.name);
        const settlementResult = this.paylineCalculator.calculate(result, bet.paylines, odds);
        settlementResult.winningPaylines = this.settleWinningPaylines(settlementResult);

        return { result, settlementResult };
    }

    generateResult(playerName) {
        const { mode } = this.gameData.gameConfigs.slotsConfig;

        // Generate board with wild multipliers already processed
        let board = this.boardGenerator.generate(mode);

        // Apply cheating rules if any
        return this.boardCheatingConsumer.consume(playerName, board);
    }

    settleWinningPaylines(settlementResult) {
        return settlementResult.paylines.filter((payline) => payline.odds > 0);
    }
}
