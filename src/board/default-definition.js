export default {
    numberOfColumns: 5,
    numberOfRows: 3,
    numberOfSymbols: 11,
    specialSymbols: {
        jackpot: 10,
        replacement: 9,
        bonus: 8,
        freeSpins: 7,
    },
    fillingStrategies: {
        reel1: {
            WILD: 1, // Very rare on first reel
            SCATTER: 2, // Moderate scatter frequency
            HARRY: 4, // High paying symbols are rare
            RON: 4,
            NEVILLE: 5,
            HERMIONE: 5,
            A: 8, // Medium symbols more common
            K: 8,
            Q: 10, // Low paying symbols most common
            J: 12,
            T: 12,
        },
        reel2: {
            WILD: 2,
            SCATTER: 2,
            HARRY: 3, // Even rarer high pays
            RON: 3,
            NEVILLE: 4,
            HERMIONE: 4,
            A: 10,
            K: 10,
            Q: 12,
            J: 15,
            T: 15,
        },
        reel3: {
            WILD: 2,
            SCATTER: 3, // Slightly higher scatter chance in middle
            HARRY: 2, // Very rare high pays in middle
            RON: 2,
            NEVILLE: 3,
            HERMIONE: 3,
            A: 12,
            K: 12,
            Q: 15,
            J: 18,
            T: 18,
        },
        reel4: {
            WILD: 3,
            SCATTER: 2,
            HARRY: 1, // Extremely rare high pays
            RON: 1,
            NEVILLE: 2,
            HERMIONE: 2,
            A: 15,
            K: 15,
            Q: 18,
            J: 20,
            T: 20,
        },
        reel5: {
            WILD: 4, // More wilds on last reel
            SCATTER: 2,
            HARRY: 1, // Almost impossible to get 5 high pays
            RON: 1,
            NEVILLE: 1,
            HERMIONE: 1,
            A: 18,
            K: 18,
            Q: 20,
            J: 25,
            T: 25,
        },
    },
    fillingStrategyForBots: {
        jackpot: [
            [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5],
            [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 4],
            [4, 2, 1, 1, 1, 1, 1, 1, 1, 1, 0],
        ],
        normal: [
            [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5],
            [0, 1, 0, 0, 0, 0, 0, 2, 2, 0, 0],
            [3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        ],
        jackpotPossibilityRange: 2000,
    },
    numberOfShuffles: 3,
    paylines: [
        [1, 4, 7, 10, 13], // Line 1: Middle horizontal
        [0, 3, 6, 9, 12], // Line 2: Top horizontal
        [2, 5, 8, 11, 14], // Line 3: Bottom horizontal
        [2, 4, 6, 10, 14], // Line 4: V shape
        [0, 4, 8, 10, 12], // Line 5: Inverted V shape

        // Zigzag patterns
        [1, 3, 6, 9, 13], // Line 6
        [1, 5, 8, 11, 13], // Line 7
        [0, 3, 7, 11, 14], // Line 8
        [2, 5, 7, 9, 12], // Line 9
        [1, 5, 7, 9, 13], // Line 10

        // More complex patterns
        [1, 3, 7, 11, 13], // Line 11
        [0, 4, 7, 10, 12], // Line 12
        [2, 4, 7, 10, 14], // Line 13
        [0, 4, 6, 10, 12], // Line 14
        [2, 4, 8, 10, 14], // Line 15

        // Additional patterns
        [1, 4, 6, 10, 13], // Line 16
        [1, 4, 8, 10, 13], // Line 17
        [0, 3, 8, 9, 12], // Line 18
        [2, 5, 6, 11, 14], // Line 19
        [0, 5, 8, 11, 12], // Line 20
    ],
    freeSpinsConfig: {
        triggerSymbol: "SCATTER",
        scattersToTrigger: 3,
        initialSpins: 3,
        multiplierProgression: [2, 5, 10, 25, 100], // Multiplier increases with each retrigger
        initialMultiplierIndex: 0, // Starts with 2x (first element)
    },
    symbols: {
        WILD: {
            id: "WILD",
            isWild: true,
            randomMultipliers: [2, 3, 4, 5], // Random multipliers for wild symbols
            pays: {
                5: 100,
                4: 5,
                3: 2.5,
            },
        },
        SCATTER: {
            id: "SCATTER",
            isScatter: true,
            triggersFeature: true,
            pays: {
                5: 100,
                4: 5,
                3: 2.5,
            },
        },
        HARRY: {
            id: "HARRY",
            pays: {
                5: 25,
                4: 5,
                3: 2.5,
            },
        },
        RON: {
            id: "RON",
            pays: {
                5: 12.5,
                4: 2.5,
                3: 1.2,
            },
        },
        NEVILLE: {
            id: "NEVILLE",
            pays: {
                5: 7.5,
                4: 1.5,
                3: 1,
            },
        },
        HERMIONE: {
            id: "HERMIONE",
            pays: {
                5: 7.5,
                4: 1.5,
                3: 1,
            },
        },
        A: {
            id: "A",
            pays: {
                5: 4,
                4: 0.8,
                3: 0.4,
            },
        },
        K: {
            id: "K",
            pays: {
                5: 3,
                4: 0.6,
                3: 0.3,
            },
        },
        Q: {
            id: "Q",
            pays: {
                5: 3,
                4: 0.6,
                3: 0.3,
            },
        },
        J: {
            id: "J",
            pays: {
                5: 2,
                4: 0.4,
                3: 0.2,
            },
        },
        T: {
            id: "T",
            pays: {
                5: 2,
                4: 0.4,
                3: 0.2,
            },
        },
    },
};
