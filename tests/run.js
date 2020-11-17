import BoardGenerator from "../src/board/board-generator";
import BonusBoardGenerator from "../src/board/bonus-board-generator";
import difficulties from "../src/board/difficulties";
import PaylineCalculator from "../src/board/payline-calculator";
import odds from "./odds";

function formatBoard(board) {
    const formattedBoard = [];

    for (let row = 0; row < 3; row++) {
        const formattedRow = [];

        for (let column = 0; column < 5; column++) {
            formattedRow.push(board[row + column * 3]);
        }

        formattedBoard.push(formattedRow);
    }

    return formattedBoard;
}

function generateThreeBoards() {
    const generator = new BoardGenerator();
    const calculator = new PaylineCalculator();
    const paylines = [...Array(25).keys()];

    console.log(generator.anySymbolPossibilities);
    console.log(generator.lowPrizedSymbolPossibilities);

    for (let counter = 0; counter < 3; counter++) {
        const board = generator.generate(difficulties.medium);

        console.log("Board");
        console.log("================================================================");
        console.log(formatBoard(board));

        console.log("Paylines");
        console.log("================================================================");
        console.log(calculator.countSymbolsInBoard(board));

        console.log("Results");
        console.log("================================================================");
        console.log(calculator.calculate(board, paylines, odds));
    }
}

function runOneMillions() {
    const generator = new BoardGenerator();
    const calculator = new PaylineCalculator();
    const paylines = [...Array(25).keys()];
    const summary = {
        jackpot: 0,
        freeSpins: 0,
        bonus: 0,
        wild: 0,
        wildByOdds: {
            8: 0,
            50: 0,
            1000: 0,
            8000: 0,
        },
    };

    for (let counter = 0; counter < 1000000; counter++) {
        const board = generator.generate(difficulties.medium);
        const result = calculator.calculate(board, paylines, odds);

        if (result.jackpot) {
            summary.jackpot += 1;
        }

        result.paylines.forEach((payline) => {
            if (payline.symbol === "9" && payline.odds > 0) {
                summary.wild += 1;
                summary.wildByOdds[payline.odds] += 1;
            }
        });

        summary.freeSpins += result.freeSpins;
        summary.bonus += result.bonus;
    }

    console.log(summary);
}

function runOneMillionsForBots() {
    const generator = new BoardGenerator();
    const calculator = new PaylineCalculator();
    const paylines = [...Array(25).keys()];
    const summary = {
        jackpot: 0,
        freeSpins: 0,
        bonus: 0,
    };

    for (let counter = 0; counter < 1000000; counter++) {
        const board = generator.generateForBots();
        const result = calculator.calculate(board, paylines, odds);

        if (result.jackpot) {
            summary.jackpot += 1;
        }

        summary.freeSpins += result.freeSpins;
        summary.bonus += result.bonus;
    }

    console.log(summary);
}

function run() {
    const generator = new BoardGenerator();
    const calculator = new PaylineCalculator();
    const paylines = [...Array(25).keys()];

    const board = [6, 2, 9, 1, 0, 9, 2, 1, 9, 0, 0, 9, 0, 6, 9]; //generator.generate(difficulties.medium);
    const result = calculator.calculate(board, paylines, odds);

    console.log(formatBoard(board));
    console.log(result);
}

function generateBonusBonus() {
    const board = new BonusBoardGenerator({ size: 10, minRate: 8, maxRate: 28 }).generate(100);

    console.log(board);
}

generateBonusBonus();
