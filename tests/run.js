// import BoardGenerator from "./../src/board/board-generator";
import Chance from "chance";

import BonusBoardGenerator from "./../src/board/bonus-board-generator";

// import odds from "./odds";

// import difficulties from "./../src/board/difficulties";
// import PaylineCalculator from "./../src/board/payline-calculator";
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
        console.log("----------------------------------------------------------------");
        console.log(calculator.countSymbolsInBoard(board));

        console.log("Results");
        console.log("****************************************************************");
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

        if (result.jackpotPayline >= 0) {
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

        if (result.jackpotPayline >= 0) {
            summary.jackpot += 1;
        }

        summary.freeSpins += result.freeSpins;
        summary.bonus += result.bonus;
    }

    console.log(summary);
}

function calculateSettlementResultOfSpecificBoard() {
    const calculator = new PaylineCalculator();
    const paylines = [...Array(25).keys()];

    const board = [0, 4, 5, 0, 0, 0, 7, 2, 5, 1, 3, 1, 3, 8, 2];
    const result = calculator.calculate(board, paylines, odds);

    for (const row of formatBoard(board)) {
        console.log(row);
    }

    console.log(result);
}

function generateBonusBonus() {
    const board = new BonusBoardGenerator({ bonusSize: 10 }).generate(100, 8, 28);

    console.log(board);
}

function checkedUnpickedBonus() {
    const bonusChests = new BonusBoardGenerator({ bonusSize: 10 }).generate(100, 8, 28);
    const chance = new Chance();

    console.log("==========Generate bonus===========");
    console.log(bonusChests);

    bonusChests[0].picked = true;
    bonusChests[6].picked = true;
    bonusChests[3].picked = true;

    const unpickedChests = bonusChests.filter((chest) => !chest.picked);
    const remainingChests = 4 - (10 - unpickedChests.length);
    const autoPickedChests = chance.pickset(unpickedChests, remainingChests);

    console.log("===========After picking bonus============");
    console.log(bonusChests);
    autoPickedChests.forEach((chest) => {
        const chestIndex = bonusChests.indexOf(chest);

        console.log(`auto open chest number ${chestIndex} - amount ${chest.amount}`);

        chest.picked = true;
    });
}

function checkPosibility() {
    const generator = new BoardGenerator();

    console.log(generator.anySymbolPossibilities);
}

checkedUnpickedBonus();
