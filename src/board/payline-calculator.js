import defaultDefinition from "./default-definition";

/**
 * PAYLINE CALCULATOR - Win Evaluation Engine
 *
 * PURPOSE:
 * Evaluates all 25 paylines for winning combinations, handles wild symbols,
 * calculates payout multipliers, and detects special feature triggers.
 *
 * KEY FEATURES:
 * - Wild symbol substitution (symbol 9)
 * - Profit optimization per payline
 * - Special feature detection (bonus, free spins, jackpot)
 * - Column-based feature triggers
 *
 * SYMBOL BEHAVIOR:
 * - Symbols 0-6: Standard payout symbols (use odds table)
 * - Symbol 7 (freeSpins): Column trigger, no direct payout
 * - Symbol 8 (bonus): Column trigger, no direct payout
 * - Symbol 9 (wild): Substitutes for any symbol except specials
 * - Symbol 10 (jackpot): 5-in-a-row trigger, uses odds table
 */
export default class PaylineCalculator {
    /**
     * @param {defaultDefinition} boardDefinition - Game configuration with symbol mappings
     */
    constructor(boardDefinition) {
        this.definition = boardDefinition ?? defaultDefinition;

        // Special symbols that don't pay direct odds but trigger features
        this.specialSymbols = Object.values(this.definition.specialSymbols).map((symbol) => String(symbol));
        // specialSymbols = ["7", "8", "9", "10"] (freeSpins, bonus, wild, jackpot)

        // Symbols that don't use the odds table for direct payouts
        this.ignoringOddsSymbols = [String(this.definition.specialSymbols.freeSpins), String(this.definition.specialSymbols.bonus)];
        // ignoringOddsSymbols = ["7", "8"] - these trigger features, don't pay direct odds
    }

    /**
     * MAIN CALCULATION ENGINE
     *
     * Process Flow:
     * 1. Count symbols in each payline with wild substitution
     * 2. Calculate odds for each possible winning symbol per payline
     * 3. Choose most profitable symbol per payline (profit optimization)
     * 4. Detect special features (bonus, free spins, jackpot)
     *
     * @param {Array} board - 15-symbol board [s0,s1,s2,...,s14]
     * @param {Array} selectedPaylines - Payline indices to evaluate (usually [0-24])
     * @param {Object} odds - Payout table from odds.js
     * @returns {Object} - Complete settlement result
     */
    calculate(board, selectedPaylines, odds) {
        // Step 1: Count symbols in each payline (with wild substitution)
        const occurrences = this.countSymbolsInBoard(board);

        // Step 2: Filter to selected paylines only
        const occurrencesInSelectedPaylines = selectedPaylines.map((paylineIndex) => ({
            paylineIndex,
            occurrences: occurrences[paylineIndex]
        }));

        // Step 3: Calculate payouts and choose most profitable symbol per payline
        const paylinesResult = occurrencesInSelectedPaylines.map((occurrencesByPayline) => {
            // Calculate odds for each symbol that appears in this payline
            const occurrencesWithOddsByPayline = Object.entries(occurrencesByPayline.occurrences)
                .reduce((occurrencesWithOdds, [symbol, count]) => {
                    // Special symbols (7,8) don't pay direct odds - they trigger features
                    const symbolOdds = this.ignoringOddsSymbols.includes(symbol) ? 0 : odds[symbol][count];

                    occurrencesWithOdds[symbol] = symbolOdds ?? 0;
                    return occurrencesWithOdds;
                }, {});

            // PROFIT OPTIMIZATION: Choose the symbol with highest payout
            // If payline has both 3×Symbol1 (odds=5) AND 3×Symbol3 (odds=10),
            // chooses Symbol3 for maximum payout
            const mostProfitableSymbol = Object.keys(occurrencesWithOddsByPayline)
                .reduce((highestOddsSymbol, symbol) =>
                    occurrencesWithOddsByPayline[symbol] > occurrencesWithOddsByPayline[highestOddsSymbol]
                        ? symbol : highestOddsSymbol
                );

            return {
                payline: occurrencesByPayline.paylineIndex,
                symbol: mostProfitableSymbol,
                count: occurrencesByPayline.occurrences[mostProfitableSymbol],
                odds: occurrencesWithOddsByPayline[mostProfitableSymbol],
            };
        });

        // Step 4: Detect special features
        return {
            paylines: paylinesResult,                    // Array of winning paylines
            freeSpins: this.calculateFreeSpins(board, occurrencesInSelectedPaylines, odds),  // Column-based
            bonus: this.calculateBonus(board, occurrencesInSelectedPaylines, odds),          // Column-based
            jackpotPayline: this.getJackpotWinningPayline(board, occurrencesInSelectedPaylines), // Payline-based
        };
    }

    /**
     * FREE SPINS DETECTION - Column-Based Trigger
     *
     * How it works:
     * 1. Count symbol 7 (freeSpins) in each column
     * 2. Find columns that are COMPLETELY filled with symbol 7
     * 3. Number of such columns = number of free spins awarded
     *
     * Example: If columns 1, 3, 4 have all 3 positions = symbol 7
     * → Awards 3 free spins (odds[7][3] from odds table)
     *
     * @param {Array} board - 15-symbol board
     * @param {Array} paylines - Payline occurrence data (unused for column calculation)
     * @param {Object} odds - Payout table
     * @returns {Object} - Free spins result
     */
    calculateFreeSpins(board, paylines, odds) {
        // Count symbol 7 per column
        const countingByColumns = this.countSpecificSymbolPerColumn(board, this.definition.specialSymbols.freeSpins);

        // Number of columns completely filled with symbol 7
        const numberOfColumns = Object.keys(countingByColumns).length;

        // Get free spins amount from odds table
        const numberOfFreeSpins = odds[this.definition.specialSymbols.freeSpins]?.[numberOfColumns] ?? 0;

        return {
            count: numberOfColumns,     // Number of triggering columns
            odds: numberOfFreeSpins,    // Free spins awarded
        };
    }

    /**
     * BONUS DETECTION - Column-Based Trigger
     *
     * How it works:
     * 1. Count symbol 8 (bonus) in each column
     * 2. Find columns that are COMPLETELY filled with symbol 8
     * 3. Number of such columns = number of bonus chests to generate
     *
     * Note: Bonus symbols don't pay direct odds - they trigger the bonus mini-game
     * The "odds" here represents the number of bonus chests, not a payout multiplier
     *
     * @param {Array} board - 15-symbol board
     * @param {Array} paylines - Payline occurrence data (unused)
     * @param {Object} odds - Payout table (actually chest count for bonus)
     * @returns {Object} - Bonus result
     */
    calculateBonus(board, paylines, odds) {
        // Count symbol 8 per column
        const countingByColumns = this.countSpecificSymbolPerColumn(board, this.definition.specialSymbols.bonus);

        // Number of columns completely filled with symbol 8
        const numberOfColumns = Object.keys(countingByColumns).length;

        // Get bonus chest count from odds table
        const numberOfBonusHits = odds[this.definition.specialSymbols.bonus]?.[numberOfColumns] ?? 0;

        return {
            count: numberOfColumns,     // Number of triggering columns
            odds: numberOfBonusHits,    // Bonus chests to generate
        };
    }

    /**
     * COLUMN COUNTING UTILITY
     *
     * Counts occurrences of a specific symbol in each column.
     * Only counts columns that have the symbol (partial fills don't count).
     *
     * Board Layout:
     * Column 0: positions [0,1,2]
     * Column 1: positions [3,4,5]
     * Column 2: positions [6,7,8]
     * Column 3: positions [9,10,11]
     * Column 4: positions [12,13,14]
     *
     * @param {Array} board - 15-symbol board
     * @param {number} sample - Symbol to count (7 for freeSpins, 8 for bonus)
     * @returns {Object} - Column counts {columnIndex: count}
     */
    countSpecificSymbolPerColumn(board, sample) {
        return board.reduce((countingByColumns, symbol, index) => {
            if (symbol === sample) {
                // Calculate column from board position
                const column = ~~(index / this.definition.numberOfRows);  // 3 rows per column

                countingByColumns[column] = (countingByColumns[column] ?? 0) + 1;
            }

            return countingByColumns;
        }, {});
    }

    /**
     * JACKPOT DETECTION - Payline-Based Trigger
     *
     * Jackpot Condition:
     * - Must have exactly 5 jackpot symbols (10) in a single payline
     * - No wild symbol substitution allowed for jackpots
     * - Returns payline index or -1 if no jackpot
     *
     * @param {Array} board - 15-symbol board
     * @param {Array} paylines - Payline occurrence data
     * @returns {number} - Winning payline index or -1
     */
    getJackpotWinningPayline(board, paylines) {
        const jackpotPayline = paylines.find(
            (payline) => payline.occurrences[this.definition.specialSymbols.jackpot] === this.definition.numberOfColumns
        );

        return jackpotPayline?.paylineIndex ?? -1;
    }

    /**
     * SYMBOL COUNTING FOR ALL PAYLINES
     *
     * Evaluates each of the 25 paylines and counts symbols (with wild substitution).
     *
     * @param {Array} board - 15-symbol board
     * @returns {Array} - Array of 25 occurrence objects
     */
    countSymbolsInBoard(board) {
        const paylinePatterns = this.definition.paylines;

        return paylinePatterns.map((pattern) => {
            // Extract symbols for this payline from board
            const payline = pattern.map((cellIndex) => board[cellIndex]);

            return this.countSymbolsInPayline(payline);
        });
    }

    /**
     * SYMBOL COUNTING WITH WILD SUBSTITUTION
     *
     * Wild Symbol Logic (Symbol 9):
     * 1. Count all symbols including wilds
     * 2. Apply wilds to regular symbols only (not specials 7,8,9,10)
     *
     * Example: Payline [2, 9, 2, 4, 2]
     * - Raw count: {2: 3, 9: 1, 4: 1}
     * - After wild: {2: 4, 9: 1, 4: 1} (wild adds to symbol 2)
     * - Result: 4-of-a-kind Symbol 2 payout
     *
     * @param {Array} payline - 5 symbols from a single payline
     * @returns {Object} - Symbol counts with wild substitution applied
     */
    countSymbolsInPayline(payline) {
        let replacements = 0;  // Number of wild symbols found

        // First pass: count symbols and identify wilds
        const occurrencesBySymbols = payline.reduce((occurrences, symbol) => {
            if (symbol === this.definition.specialSymbols.replacement) {
                replacements++;  // Count wild symbols
            }

            occurrences[symbol] = (occurrences[symbol] ?? 0) + 1;
            return occurrences;
        }, {});

        // Second pass: apply wilds to regular symbols only
        Object.keys(occurrencesBySymbols).forEach((symbol) => {
            // Don't apply wilds to special symbols (7,8,9,10)
            if (!this.specialSymbols.includes(symbol)) {
                occurrencesBySymbols[symbol] += replacements;
            }
        });

        return occurrencesBySymbols;
    }
}
