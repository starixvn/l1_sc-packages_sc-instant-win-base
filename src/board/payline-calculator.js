import defaultDefinition from "./default-definition";

export default class PaylineCalculator {
    /**
     * @param {defaultDefinition} boardDefinition
     */
    constructor(boardDefinition) {
        this.definition = boardDefinition ?? defaultDefinition;
        this.specialSymbols = Object.values(this.definition.specialSymbols).map((symbol) => String(symbol));
        this.ignoringOddsSymbols = [String(this.definition.specialSymbols.freeSpins), String(this.definition.specialSymbols.bonus)];
    }

    calculate(board, selectedPaylines, odds) {
        const occurrences = this.countSymbolsInBoard(board);
        const occurrencesInSelectedPaylines = selectedPaylines.map((paylineIndex) => ({ paylineIndex, occurrences: occurrences[paylineIndex] }));
        const paylinesResult = occurrencesInSelectedPaylines.map((occurrencesByPayline) => {
            const occurrencesWithOddsByPayline = Object.entries(occurrencesByPayline.occurrences).reduce((occurrencesWithOdds, [symbol, count]) => {
                const symbolOdds = this.ignoringOddsSymbols.includes(symbol) ? 0 : odds[symbol][count];

                occurrencesWithOdds[symbol] = symbolOdds ?? 0;

                return occurrencesWithOdds;
            }, {});
            const mostProfitableSymbol = Object.keys(occurrencesWithOddsByPayline).reduce((highestOddsSymbol, symbol) =>
                occurrencesWithOddsByPayline[symbol] > occurrencesWithOddsByPayline[highestOddsSymbol] ? symbol : highestOddsSymbol
            );

            return {
                payline: occurrencesByPayline.paylineIndex,
                symbol: mostProfitableSymbol,
                count: occurrencesByPayline.occurrences[mostProfitableSymbol],
                odds: occurrencesWithOddsByPayline[mostProfitableSymbol],
            };
        });

        return {
            paylines: paylinesResult,
            freeSpins: this.calculateFreeSpins(board, occurrencesInSelectedPaylines, odds),
            bonus: this.calculateBonus(board, occurrencesInSelectedPaylines, odds),
            jackpotPayline: this.getJackpotWinningPayline(board, occurrencesInSelectedPaylines),
        };
    }

    calculateFreeSpins(board, paylines, odds) {
        const countingByColumns = this.countSpecificSymbolPerColumn(board, this.definition.specialSymbols.freeSpins);
        const numberOfColumns = Object.keys(countingByColumns).length;
        const numberOfFreeSpins = odds[this.definition.specialSymbols.freeSpins]?.[numberOfColumns] ?? 0;

        return {
            count: numberOfColumns,
            odds: numberOfFreeSpins,
        };
    }

    calculateBonus(board, paylines, odds) {
        const countingByColumns = this.countSpecificSymbolPerColumn(board, this.definition.specialSymbols.bonus);
        const numberOfColumns = Object.keys(countingByColumns).length;
        const numberOfBonusHits = odds[this.definition.specialSymbols.bonus]?.[numberOfColumns] ?? 0;

        return {
            count: numberOfColumns,
            odds: numberOfBonusHits,
        };
    }

    countSpecificSymbolPerColumn(board, sample) {
        return board.reduce((countingByColumns, symbol, index) => {
            if (symbol === sample) {
                const column = ~~(index / this.definition.numberOfRows);

                countingByColumns[column] = (countingByColumns[column] ?? 0) + 1;
            }

            return countingByColumns;
        }, {});
    }

    getJackpotWinningPayline(board, paylines) {
        const jackpotPayline = paylines.find(
            (payline) => payline.occurrences[this.definition.specialSymbols.jackpot] === this.definition.numberOfColumns
        );

        return jackpotPayline?.paylineIndex ?? -1;
    }

    countSymbolsInBoard(board) {
        const paylinePatterns = this.definition.paylines;

        return paylinePatterns.map((pattern) => {
            const payline = pattern.map((cellIndex) => board[cellIndex]);

            return this.countSymbolsInPayline(payline);
        });
    }

    countSymbolsInPayline(payline) {
        let replacements = 0;

        const occurrencesBySymbols = payline.reduce((occurrences, symbol) => {
            if (symbol === this.definition.specialSymbols.replacement) {
                replacements++;
            }

            occurrences[symbol] = (occurrences[symbol] ?? 0) + 1;

            return occurrences;
        }, {});

        Object.keys(occurrencesBySymbols).forEach((symbol) => {
            if (!this.specialSymbols.includes(symbol)) {
                occurrencesBySymbols[symbol] += replacements;
            }
        });

        return occurrencesBySymbols;
    }
}
