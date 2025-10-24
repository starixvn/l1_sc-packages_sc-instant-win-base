/**
 * SLOT MACHINE PAYOUT TABLE (ODDS MULTIPLIERS)
 *
 * Defines payout multipliers for winning combinations.
 * Multipliers are applied per payline bet amount.
 *
 * SYMBOL PAYOUT HIERARCHY (High to Low):
 * - Symbol 0: Highest paying (2x, 5x, 10x for 3/4/5 in row)
 * - Symbol 1: Very high paying (5x, 10x, 25x)
 * - Symbol 2: High paying (5x, 25x, 50x)
 * - Symbol 3: Medium-high (10x, 30x, 150x)
 * - Symbol 4: Medium (12x, 45x, 275x)
 * - Symbol 5: Medium-low (15x, 60x, 375x)
 * - Symbol 6: Low paying (20x, 75x, 500x)
 *
 * SPECIAL SYMBOLS:
 * - Symbol 7 (FreeSpins): Column trigger, grants free spins (3/6/18 for 1/2/3 columns)
 * - Symbol 8 (Bonus): Column trigger, grants bonus chests (0 = no bonus)
 * - Symbol 9 (Wild): Substitutes for any symbol, pays wild multiplier (8x, 50x, 1000x, 8000x)
 * - Symbol 10 (Jackpot): 5-in-row trigger, pays progressive jackpot (4x, 25x, 100x, 5000x base)
 *
 * CALCULATION EXAMPLE:
 * - Player bets $1 per payline ($25 total)
 * - Gets 4× Symbol 3 on a payline
 * - Payout = $1 × 30 = $30 for that payline
 * - Plus base bet back = $31 total for that payline
 */
export default {
    // Symbol 0: Premium symbol (2x, 5x, 10x multipliers)
    0: {
        3: 2,   // 3 in a row = 2x bet multiplier
        4: 5,   // 4 in a row = 5x bet multiplier
        5: 10,  // 5 in a row = 10x bet multiplier
    },

    // Symbol 1: High-value symbol (5x, 10x, 25x multipliers)
    1: {
        3: 5,
        4: 10,
        5: 25,
    },

    // Symbol 2: Medium-high symbol (5x, 25x, 50x multipliers)
    2: {
        3: 5,
        4: 25,
        5: 50,
    },

    // Symbol 3: Medium symbol (10x, 30x, 150x multipliers)
    3: {
        3: 10,
        4: 30,
        5: 150,
    },

    // Symbol 4: Medium-low symbol (12x, 45x, 275x multipliers)
    4: {
        3: 12,
        4: 45,
        5: 275,
    },

    // Symbol 5: Low-medium symbol (15x, 60x, 375x multipliers)
    5: {
        3: 15,
        4: 60,
        5: 375,
    },

    // Symbol 6: Low symbol (20x, 75x, 500x multipliers)
    6: {
        3: 20,
        4: 75,
        5: 500,
    },

    // Symbol 7: FREE SPINS TRIGGER
    // Values represent number of free spins awarded
    7: {
        3: 3,   // 1 column filled = 3 free spins
        4: 6,   // 2 columns filled = 6 free spins
        5: 18,  // 3 columns filled = 18 free spins
    },

    // Symbol 8: BONUS TRIGGER
    // Values represent number of bonus chests generated
    8: {
        3: 0,   // Bonus symbols don't pay direct odds - they trigger features
        4: 0,
        5: 0,
    },

    // Symbol 9: WILD SYMBOL
    // Can substitute for any symbol, pays high wild multipliers
    9: {
        2: 8,      // Even 2 wilds pay well
        3: 50,
        4: 1000,   // 4 wilds = massive payout
        5: 8000,   // 5 wilds = enormous payout
    },

    // Symbol 10: JACKPOT TRIGGER
    // Base multipliers applied to progressive jackpot amounts
    10: {
        2: 4,
        3: 25,
        4: 100,
        5: 5000,   // 5 jackpots in row = 5000x jackpot pool
    },
};
