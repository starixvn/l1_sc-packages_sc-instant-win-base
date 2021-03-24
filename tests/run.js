import Chance from "chance";

import BoardGenerator from "./../src/board/board-generator";
import BonusBoardGenerator from "./../src/board/bonus-board-generator";
import difficulties from "./../src/board/difficulties";
import PaylineCalculator from "./../src/board/payline-calculator";
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
        console.log("----------------------------------------------------------------");
        console.log(calculator.countSymbolsInBoard(board));

        console.log("Results");
        console.log("****************************************************************");
        console.log(calculator.calculate(board, paylines, odds));
    }
}

function runOneMillions() {
    const chance = new Chance();
    const stakes = [0.1, 1, 5];
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
        winningPaylinesWithOdds: {},
        totalAmount: 0,
        winAmount: 0,
        winLoss: 0,
        totalPaylines: 0,
        stakes: {
            0.1: 0,
            1: 0,
            5: 0,
        },
    };
    for (let counter = 0; counter < 100000; counter++) {
        const amount = chance.pickone(stakes);
        const board = generator.generate(difficulties.hard);
        const randomPaylines = chance.pickset(paylines, chance.integer({ min: 1, max: 25 }));
        const result = calculator.calculate(board, randomPaylines, odds);
        summary.totalAmount += amount * randomPaylines.length;
        summary.totalPaylines += randomPaylines.length;
        summary.stakes[amount] += 1;

        if (result.jackpotPayline >= 0) {
            summary.jackpot += 1;
        }

        result.paylines.forEach((payline) => {
            if (payline.symbol === "9" && payline.odds > 0) {
                summary.wild += 1;
                summary.wildByOdds[payline.odds] += 1;
            }

            if (payline.odds > 0) {
                summary.winningPaylinesWithOdds[payline.odds] = summary.winningPaylinesWithOdds[payline.odds]
                    ? summary.winningPaylinesWithOdds[payline.odds] + 1
                    : 1;
                summary.winAmount += amount * payline.odds;
            }
        });

        summary.freeSpins += result.freeSpins.odds;
        summary.bonus += result.bonus.odds;
    }

    summary.winLoss = summary.totalAmount - summary.winAmount;

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

    for (let counter = 0; counter < 100000; counter++) {
        const board = generator.generateForBots();
        const result = calculator.calculate(board, paylines, odds);

        if (result.jackpotPayline >= 0) {
            summary.jackpot += 1;
        }

        summary.freeSpins += result.freeSpins.odds;
        summary.bonus += result.bonus.odds;
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

runOneMillions();
