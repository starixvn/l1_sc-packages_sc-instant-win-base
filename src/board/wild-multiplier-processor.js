export default class WildMultiplierProcessor {
    constructor(boardConfig) {
        this.boardConfig = boardConfig;
    }

    process(board) {
        const rows = board.length;
        const cols = board[0].length;

        // Process each wild symbol on the board
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const symbol = board[row][col];
                if (symbol.isWild) {
                    // Add random multiplier to the wild symbol
                    board[row][col] = {
                        ...symbol,
                        multiplier: this.generateRandomMultiplier(),
                    };
                }
            }
        }
        return board;
    }

    generateRandomMultiplier() {
        const availableMultipliers = this.boardConfig.symbols.WILD.randomMultipliers;
        const randomIndex = Math.floor(Math.random() * availableMultipliers.length);
        return availableMultipliers[randomIndex];
    }
}
