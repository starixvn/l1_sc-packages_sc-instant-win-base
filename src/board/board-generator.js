import WildMultiplierProcessor from "./wild-multiplier-processor";

export default class BoardGenerator {
    constructor(boardConfig) {
        this.boardConfig = boardConfig;
        this.wildMultiplierProcessor = new WildMultiplierProcessor(boardConfig);
        this.reelStrips = this.generateReelStrips();
    }

    generate(mode) {
        // Generate initial board
        const board = this.generateInitialBoard();

        // Process wild multipliers
        return this.wildMultiplierProcessor.process(board);
    }

    generateReelStrips() {
        const reelStrips = [];

        // Generate 5 reel strips based on filling strategies
        for (let reelIndex = 1; reelIndex <= this.boardConfig.numberOfColumns; reelIndex++) {
            const strategy = this.boardConfig.fillingStrategies[`reel${reelIndex}`];
            const reelStrip = [];

            // Create reel strip based on weights
            for (const [symbol, weight] of Object.entries(strategy)) {
                for (let i = 0; i < weight; i++) {
                    reelStrip.push(symbol);
                }
            }

            reelStrips.push(reelStrip);
        }

        return reelStrips;
    }

    generateInitialBoard() {
        const rows = this.boardConfig.numberOfRows;
        const cols = this.boardConfig.numberOfColumns;
        const board = Array(rows)
            .fill()
            .map(() => Array(cols).fill(null));

        // Fill each position with a random symbol from corresponding reel strip
        for (let col = 0; col < cols; col++) {
            const reelStrip = this.reelStrips[col];
            const reelSymbols = this.getRandomSymbolsForReel(reelStrip, rows);

            for (let row = 0; row < rows; row++) {
                board[row][col] = {
                    ...this.boardConfig.symbols[reelSymbols[row]],
                    position: { row, col },
                };
            }
        }

        return board;
    }

    getRandomSymbolsForReel(reelStrip, count) {
        const reelLength = reelStrip.length;
        const startIndex = Math.floor(Math.random() * reelLength);
        const symbols = [];

        // Get consecutive symbols from random start position
        for (let i = 0; i < count; i++) {
            const index = (startIndex + i) % reelLength;
            symbols.push(reelStrip[index]);
        }

        return symbols;
    }
}
