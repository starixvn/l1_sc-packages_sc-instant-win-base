import defaultDefinition from "./default-definition";

export default class PaylineCalculator {
    /**
     * @param {defaultDefinition} boardDefinition
     */
    constructor(boardConfig) {
        this.boardConfig = boardConfig;
    }

    static MIN_SYMBOLS_FOR_WIN = 3;

    isWinningCombination(symbol, count) {
        return count >= PaylineCalculator.MIN_SYMBOLS_FOR_WIN && symbol.pays && symbol.pays[count];
    }

    shouldCountSymbol(acc, symbol, firstSymbol) {
        return acc.shouldCount && (symbol.id === firstSymbol.id || symbol.isWild);
    }

    calculateWinDetails(firstSymbol, matchingSymbols, odds, isFreeSpin, freeSpinMultiplier) {
        const { count, wildMultiplier } = matchingSymbols;
        const hasWin = this.isWinningCombination(firstSymbol, count);
        const totalMultiplier = wildMultiplier * (isFreeSpin ? freeSpinMultiplier : 1);
        const win = hasWin ? firstSymbol.pays[count] * odds * totalMultiplier : 0;

        return {
            hasWin,
            win,
            count,
            totalMultiplier,
        };
    }

    calculate(board, paylines, odds, isFreeSpin = false, freeSpinMultiplier = 1) {
        const calculatedPaylines = paylines.map((payline) => {
            const symbols = this.getPaylineSymbols(board, payline);
            const firstSymbol = symbols[0];

            const matchingSymbols = symbols.slice(1).reduce(
                (acc, symbol) => {
                    if (this.shouldCountSymbol(acc, symbol, firstSymbol)) {
                        return {
                            count: acc.count + 1,
                            wildMultiplier: this.calculateWildMultiplier(acc.wildMultiplier, symbol),
                            shouldCount: true,
                        };
                    }
                    return { ...acc, shouldCount: false };
                },
                { count: 1, wildMultiplier: 1, shouldCount: true }
            );

            const { hasWin, win, count, totalMultiplier } = this.calculateWinDetails(
                firstSymbol,
                matchingSymbols,
                odds,
                isFreeSpin,
                freeSpinMultiplier
            );

            return {
                payline,
                win,
                count: hasWin ? count : 0,
                symbol: hasWin ? firstSymbol.id : null,
                multiplier: hasWin ? totalMultiplier : 1,
                positions: hasWin ? payline.slice(0, count) : [],
            };
        });

        return {
            totalWin: calculatedPaylines.reduce((sum, payline) => sum + payline.win, 0),
            paylines: calculatedPaylines,
        };
    }

    getPaylineSymbols(board, payline) {
        return payline.map((position) => {
            const row = Math.floor(position / this.boardConfig.numberOfColumns);
            const col = position % this.boardConfig.numberOfColumns;
            return board[row][col];
        });
    }

    /**
     * Calculates the cumulative multiplier when wild symbols are present in a winning combination
     * @param {number} wildMultiplier - The current accumulated wild multiplier
     * @param {Object} symbol - The symbol being evaluated
     * @param {boolean} symbol.isWild - Whether the symbol is a wild symbol
     * @param {number} [symbol.multiplier] - The multiplier value of the wild symbol (if any)
     * @returns {number} - The new accumulated wild multiplier
     */
    calculateWildMultiplier(wildMultiplier, symbol) {
        if (symbol.isWild && symbol.multiplier) {
            return wildMultiplier * symbol.multiplier;
        }
        return wildMultiplier;
    }
}
