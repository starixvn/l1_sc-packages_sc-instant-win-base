import defaultDefinition from "./default-definition";

export default class PaylineCalculator {
    constructor(definition) {
        this.definition = definition ?? defaultDefinition;
        this.specialSymbols = Object.values(this.definition.specialSymbols);
    }

    calculate(board) {
        const paylinePatterns = this.definition.paylines;
        const result = paylinePatterns.map((pattern) => {
            const payline = pattern.map((cellIndex) => board[cellIndex]);

            return this.calculateSinglePayline(payline);
        });

        return result;
    }

    calculateSinglePayline(payline) {
        let replacements = 0;

        const occurrencesBySymbols = payline.reduce((occurrences, symbol) => {
            if (symbol === this.definition.specialSymbols.replacement) {
                replacements++;
            }

            occurrences[symbol] = (occurrences[symbol] ?? 0) + 1;
        }, {});

        Object.keys(occurrencesBySymbols).forEach((symbol) => {
            if (!this.definition.specialSymbols.includes(symbol)) {
                occurrencesBySymbols[symbol] += replacements;
            }
        });

        return occurrencesBySymbols;
    }
}
