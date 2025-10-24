/**
 * CORE GAME MECHANICS CONFIGURATION
 * Defines the fundamental rules and probabilities for the 5x3 slot machine
 *
 * BOARD STRUCTURE:
 * - 5 columns x 3 rows = 15 total symbol positions
 * - 11 symbols (0-10) with special meanings for symbols 7,8,9,10
 *
 * GAME BALANCE:
 * - Filling strategies control RTP (Return to Player) per difficulty level
 * - Higher weights = more frequent symbol appearance
 * - Special symbols appear less frequently to maintain house edge
 */
export default {
    // BOARD DIMENSIONS
    numberOfColumns: 5,    // Horizontal columns (0-4)
    numberOfRows: 3,       // Vertical rows per column
    numberOfSymbols: 11,   // Total symbols: 0-10

    // SPECIAL SYMBOL DEFINITIONS
    // These symbols trigger game features instead of paying direct odds
    specialSymbols: {
        jackpot: 10,        // 5-in-a-row triggers progressive jackpot
        replacement: 9,     // Wild symbol - substitutes for any symbol except specials
        bonus: 8,           // Column-based trigger for bonus mini-game
        freeSpins: 7,       // Column-based trigger for free spins feature
    },

    // PLAYER DIFFICULTY STRATEGIES
    // Controls RTP by adjusting symbol frequency per difficulty level
    // Each array represents symbol weights for one row [symbol0, symbol1, ..., symbol10]
    fillingStrategies: {
        // HARD MODE: Lowest RTP - rare high-value symbols, harder wins
        hard: [
            [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5],  // Row 1: High-value symbols (0-5) common
            [1, 1, 1, 2, 1, 0, 0, 1, 1, 0, 0],            // Row 2: Some bonus/free spins, few specials
            [3, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],            // Row 3: Mostly low-value, rare specials
        ],

        // MEDIUM MODE: Balanced RTP - moderate symbol distribution
        medium: [
            [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5],  // Row 1: Same high-value distribution
            [2, 1, 1, 2, 1, 1, 1, 0, 0, 0, 0],            // Row 2: More balanced symbol mix
            [1, 1, 2, 0, 1, 0, 0, 0, 0, 0, 0],            // Row 3: Some bonus opportunities
        ],

        // EASY MODE: Highest RTP - more frequent wins, balanced distribution
        easy: [
            [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5],  // Row 1: Same high-value distribution
            [2, 1, 2, 2, 1, 2, 2, 1, 1, 0, 0],            // Row 2: Good mix, bonus/free spins possible
            [1, 1, 2, 0, 1, 0, 0, 0, 0, 0, 0],            // Row 3: Balanced with some bonus chance
        ],
    },

    // BOT PLAY STRATEGIES
    // Separate logic for automated players to maintain game activity
    fillingStrategyForBots: {
        // JACKPOT MODE: Rare bot jackpot wins (controlled probability)
        jackpot: [
            [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5],  // Row 1: Normal high-value
            [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4],            // Row 2: Wild symbols (9) weight 4
            [4, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0],            // Row 3: Jackpot symbols (10) weight 4
        ],

        // NORMAL BOT PLAY: Slightly more bonus features for engagement
        normal: [
            [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5],  // Row 1: Normal high-value
            [0, 1, 0, 0, 0, 0, 0, 2, 2, 0, 0],            // Row 2: Bonus symbols (8) more common
            [3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],            // Row 3: Normal symbol distribution
        ],

        // JACKPOT PROBABILITY CONTROL
        jackpotPossibilityRange: 2000,  // Base range for bot jackpot calculations
    },

    // RANDOMIZATION SETTINGS
    numberOfShuffles: 3,  // Shuffle board 3x for true randomness

    // PAYLINE DEFINITIONS (25 total paylines)
    // Each array contains 5 board positions that form a winning line
    // Board positions: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14]
    // Layout: Column 0: [0,1,2], Column 1: [3,4,5], etc.
    paylines: [
        [1, 4, 7, 10, 13],    // Payline 0: Middle row horizontal
        [0, 3, 6, 9, 12],     // Payline 1: Top row horizontal
        [2, 5, 8, 11, 14],    // Payline 2: Bottom row horizontal
        [2, 4, 6, 10, 14],    // Payline 3: Diagonal bottom-left to top-right
        [0, 4, 8, 10, 12],    // Payline 4: Diagonal top-left to bottom-right

        [1, 3, 6, 9, 13],     // Payline 5: Mixed pattern
        [1, 5, 8, 11, 13],    // Payline 6: Mixed pattern
        [0, 3, 7, 11, 14],    // Payline 7: Mixed pattern
        [2, 5, 7, 9, 12],     // Payline 8: Mixed pattern
        [1, 5, 7, 9, 13],     // Payline 9: Mixed pattern

        [1, 3, 7, 11, 13],    // Payline 10: Mixed pattern
        [0, 4, 7, 10, 12],    // Payline 11: Mixed pattern
        [2, 4, 7, 10, 14],    // Payline 12: Mixed pattern
        [0, 4, 6, 10, 12],    // Payline 13: Mixed pattern
        [2, 4, 8, 10, 14],    // Payline 14: Mixed pattern

        [1, 4, 6, 10, 13],    // Payline 15: Mixed pattern
        [1, 4, 8, 10, 13],    // Payline 16: Mixed pattern
        [0, 3, 8, 9, 12],     // Payline 17: Mixed pattern
        [2, 5, 6, 11, 14],    // Payline 18: Mixed pattern
        [0, 5, 8, 11, 12],    // Payline 19: Mixed pattern

        [2, 3, 6, 9, 14],     // Payline 20: Mixed pattern
        [1, 3, 8, 9, 13],     // Payline 21: Mixed pattern
        [1, 5, 6, 11, 13],    // Payline 22: Mixed pattern
        [0, 5, 6, 11, 12],    // Payline 23: Mixed pattern
        [2, 3, 8, 9, 14],     // Payline 24: Mixed pattern
    ],
};
