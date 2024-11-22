import BoardGenerator from "../board-generator";
import defaultDefinition from "../default-definition";

describe("BoardGenerator", () => {
    let generator;

    beforeEach(() => {
        generator = new BoardGenerator(defaultDefinition);
    });

    test("should generate reel strips with correct weights", () => {
        const reelStrips = generator.reelStrips;

        // Check if we have the correct number of reels
        expect(reelStrips.length).toBe(defaultDefinition.numberOfColumns);

        // Test first reel's composition
        const firstReel = reelStrips[0];
        const symbolCounts = {};

        firstReel.forEach((symbol) => {
            symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
        });

        // Check if weights match the filling strategy
        Object.entries(defaultDefinition.fillingStrategies.reel1).forEach(([symbol, weight]) => {
            expect(symbolCounts[symbol]).toBe(weight);
        });
    });

    test("should generate board with correct dimensions", () => {
        const board = generator.generate();

        expect(board.length).toBe(defaultDefinition.numberOfRows);
        expect(board[0].length).toBe(defaultDefinition.numberOfColumns);
    });

    test("should generate valid symbols with positions", () => {
        const board = generator.generate();

        board.forEach((row, rowIndex) => {
            row.forEach((symbol, colIndex) => {
                // Check symbol properties
                expect(symbol).toHaveProperty("id");
                expect(symbol).toHaveProperty("position");
                expect(symbol.position).toEqual({ row: rowIndex, col: colIndex });

                // Verify symbol is from the definition
                expect(defaultDefinition.symbols[symbol.id]).toBeDefined();
            });
        });
    });

    test("should generate consecutive symbols from reel strips", () => {
        const board = generator.generate();

        // Get symbols from first column
        const firstColSymbols = board.map((row) => row[0].id);

        // These symbols should exist consecutively somewhere in the first reel strip
        const firstReelStrip = generator.reelStrips[0];

        // Helper function to check if symbols appear consecutively in reel
        const findConsecutiveSymbols = (strip, symbols) => {
            for (let i = 0; i <= strip.length - symbols.length; i++) {
                const consecutive = strip.slice(i, i + symbols.length);
                if (JSON.stringify(consecutive) === JSON.stringify(symbols)) {
                    return true;
                }
            }
            // Check wrap-around case
            const wrappedStrip = [...strip, ...strip.slice(0, symbols.length - 1)];
            for (let i = 0; i <= strip.length - 1; i++) {
                const consecutive = wrappedStrip.slice(i, i + symbols.length);
                if (JSON.stringify(consecutive) === JSON.stringify(symbols)) {
                    return true;
                }
            }
            return false;
        };

        expect(findConsecutiveSymbols(firstReelStrip, firstColSymbols)).toBe(true);
    });

    test("should process wild multipliers", () => {
        const board = generator.generate();

        board.forEach((row) => {
            row.forEach((symbol) => {
                if (symbol.isWild) {
                    expect(symbol.multiplier).toBeDefined();
                    expect(defaultDefinition.symbols.WILD.randomMultipliers).toContain(symbol.multiplier);
                }
            });
        });
    });

    test("should print board output", () => {
        const board = generator.generate();

        console.log("\nGenerated Board:");
        console.log("---------------");

        board.forEach((row, rowIndex) => {
            const rowStr = row
                .map((symbol) => {
                    let display = symbol.id;
                    if (symbol.isWild && symbol.multiplier) {
                        display += `(${symbol.multiplier}x)`;
                    }
                    return display.padEnd(15); // Pad for alignment
                })
                .join(" ");
            console.log(`Row ${rowIndex}: ${rowStr}`);
        });

        console.log("\nReel Strip Lengths:");
        generator.reelStrips.forEach((strip, index) => {
            console.log(`Reel ${index + 1}: ${strip.length} positions`);
        });
    });
});
