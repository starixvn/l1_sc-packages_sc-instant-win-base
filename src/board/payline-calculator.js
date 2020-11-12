import defaultDefinition from "./default-definition";

export default class PaylineCalculator {
    constructor(definition) {
        this.definition = definition ?? defaultDefinition;
        this.specialSymbols = Object.values(this.definition.specialSymbols).map((symbol) => String(symbol));
    }

    calculate(board, paylineIndices, odds) {
        const ignoringOddsSymbols = [this.definition.specialSymbols.freeSpins, this.definition.specialSymbols.bonus];
        const occurrences = this.countSymbolsInBoard(board);
        const matchedPaylines = paylineIndices.map((index) => ({ index, occurrences: occurrences[index] }));
        const paylinesResult = matchedPaylines.map((occurrencesByPayline) => {
            const occurrencesByPaylineWithOdds = Object.entries(occurrencesByPayline.occurrences).reduce((occurrencesWithOdds, [symbol, count]) => {
                const symbolOdds = ignoringOddsSymbols.includes(symbol) ? 0 : odds[symbol][count];

                occurrencesWithOdds[symbol] = symbolOdds ?? 0;

                return occurrencesWithOdds;
            }, {});
            const mostProfitableSymbol = Object.keys(occurrencesByPaylineWithOdds).reduce((highestOddsSymbol, symbol) =>
                occurrencesByPaylineWithOdds[symbol] > occurrencesByPaylineWithOdds[highestOddsSymbol] ? symbol : highestOddsSymbol
            );

            return {
                payline: occurrencesByPayline.index,
                symbol: mostProfitableSymbol,
                count: occurrencesByPayline.occurrences[mostProfitableSymbol],
                odds: occurrencesByPaylineWithOdds[mostProfitableSymbol],
            };
        });

        return {
            paylines: paylinesResult,
            freeSpins: this.calculateFreeSpins(board, matchedPaylines, odds),
            bonus: this.calculateBonus(board, matchedPaylines, odds),
            jackpot: this.checkIfWinJackpot(board, matchedPaylines),
        };
    }

    calculateFreeSpins(board, paylines, odds) {
        const countingByColumns = this.countSpecificSymbolPerColumn(board, this.definition.specialSymbols.freeSpins);
        const numberOfColumns = Object.keys(countingByColumns).length;

        return odds[this.definition.specialSymbols.freeSpins]?.[numberOfColumns] ?? 0;
    }

    calculateBonus(board, paylines, odds) {
        const countingByColumns = this.countSpecificSymbolPerColumn(board, this.definition.specialSymbols.bonus);
        const numberOfColumns = Object.keys(countingByColumns).length;

        return odds[this.definition.specialSymbols.bonus]?.[numberOfColumns] ?? 0;
    }

    countSpecificSymbolPerColumn(board, countingSymbol) {
        return board.reduce((countingByColumns, symbol, index) => {
            if (symbol === countingSymbol) {
                const column = ~~(index / this.definition.numberOfRows);

                countingByColumns[column] = (countingByColumns[column] ?? 0) + 1;
            }

            return countingByColumns;
        }, {});
    }

    checkIfWinJackpot(board, paylines) {
        return paylines.some((payline) => payline[this.definition.specialSymbols.jackpot] === this.definition.numberOfColumns);
    }

    countSymbolsInBoard(board) {
        const paylinePatterns = this.definition.paylines;
        const result = paylinePatterns.map((pattern) => {
            const payline = pattern.map((cellIndex) => board[cellIndex]);

            return this.countSymbolsInPayline(payline);
        });

        return result;
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
