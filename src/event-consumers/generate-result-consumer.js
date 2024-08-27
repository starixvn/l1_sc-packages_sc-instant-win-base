import defaultDefinition from "./../board/default-definition";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

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
     * @param {JackpotPrizeGenerator} dependencies.jackpotPrizeGenerator
     */

    constructor({
        definition,
        gameData,
        boardGenerator,
        bonusBoardGenerator,
        paylineCalculator,
        boardCheatingConsumer,
        boardDefinition,
        jackpotPrizeGenerator,
    }) {
        this.definition = definition;
        this.gameData = gameData;
        this.boardCheatingConsumer = boardCheatingConsumer;
        this.boardGenerator = boardGenerator;
        this.bonusBoardGenerator = bonusBoardGenerator;
        this.paylineCalculator = paylineCalculator;
        this.jackpotPrizeGenerator = jackpotPrizeGenerator;
        this.boardDefinition = boardDefinition ?? defaultDefinition;
    }

    generateSettlementResult(player, bet, odds) {
        const result = this.generateResult(bet.name);
        const settlementResult = this.paylineCalculator.calculate(result, bet.paylines, odds);
        const prizes = this.settleJackpot(player, settlementResult);

        if (prizes?.length > 0) {
            settlementResult.jackpot = { prizes, picked: false, winningLine: settlementResult.jackpotPayline, winningAmount: 0 };
        }

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
        return this.bonusBoardGenerator.generate(bet.bet, bonusConfig.min, bonusConfig.max, bet.paylines.length);
    }

    settleJackpot(player, settlementResult) {
        if (settlementResult.jackpotPayline > -1) {
            return this.jackpotPrizeGenerator.generate(player);
        }

        return null;
    }
}
