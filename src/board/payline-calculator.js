import defaultDefinition from "./default-definition";

export default class PaylineCalculator {
    constructor(definition) {
        this.definition = definition ?? defaultDefinition;
        this.specialSymbols = Object.values(this.definition.specialSymbols).map((symbol) => String(symbol));
        this.ignoringOddsSymbols = [this.definition.specialSymbols.freeSpins, this.definition.specialSymbols.bonus];
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
            jackpot: this.checkIfWinJackpot(board, occurrencesInSelectedPaylines),
        };
    }

    calculateFreeSpins(board, paylines, odds) {
        const countingByColumns = this.countSpecificSymbolPerColumn(board, this.definition.specialSymbols.freeSpins);
        const numberOfColumns = Object.keys(countingByColumns).length;
        const numberOfFreeSpins = odds[this.definition.specialSymbols.freeSpins]?.[numberOfColumns] ?? 0;

        return {
            numberOfSymbols: numberOfColumns,
            count: numberOfFreeSpins,
        };
    }

    calculateBonus(board, paylines, odds) {
        const countingByColumns = this.countSpecificSymbolPerColumn(board, this.definition.specialSymbols.bonus);
        const numberOfColumns = Object.keys(countingByColumns).length;
        const numberOfBonusHits = odds[this.definition.specialSymbols.bonus]?.[numberOfColumns] ?? 0;

        return {
            numberOfSymbols: numberOfColumns,
            count: numberOfBonusHits,
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

    checkIfWinJackpot(board, paylines) {
        return paylines.some((payline) => payline.occurrences[this.definition.specialSymbols.jackpot] === this.definition.numberOfColumns);
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
