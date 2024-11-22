export default class ExpandingWildProcessor {
    constructor(boardDefinition) {
        this.boardDefinition = boardDefinition;
    }

    process(board) {
        const expandedBoard = [...board];
        const rows = expandedBoard.length;
        const cols = expandedBoard[0].length;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const symbol = expandedBoard[row][col];
                const symbolDef = this.boardDefinition.symbols[symbol];

                if (symbolDef?.isWild && symbolDef.isExpanding) {
                    this.expandWild(expandedBoard, row, col, symbolDef.expandDirection);
                }
            }
        }

        return expandedBoard;
    }

    expandWild(board, row, col, direction) {
        const rows = board.length;
        const wildSymbol = board[row][col];

        for (let r = 0; r < rows; r++) {
            board[r][col] = wildSymbol;
        }
    }
}
