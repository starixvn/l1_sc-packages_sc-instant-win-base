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

function getOddsRange(noPaylines) {
    // default { min: 5, max: 20 }

    const min = Math.max(0.32 * Math.max(noPaylines - 2, 1), 1);
    const max = Math.max(1.12 * Math.max(noPaylines - 2, 1), 3);

    return { min, max };
}

function runOneMillions(mode) {
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
        totalPaylines: 0,
        stakes: {
            0.1: 0,
            1: 0,
            5: 0,
        },
        totalAmount: 0,
        winAmount: 0,
        bonusAmount: 0,
        freeSpinAmount: 0,
        winLoss: 0,
        payoutRatio: 0,
    };
    for (let counter = 0; counter < 100000; counter++) {
        const amount = chance.pickone(stakes);
        const board = generator.generate(mode);
        //const randomPaylines = [paylines[0]];
        //const randomPaylines = [chance.pickone(paylines)];
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
                summary[payline.symbol] = summary[payline.symbol] ?? {};
                summary[payline.symbol][payline.odds] = (summary[payline.symbol][payline.odds] ?? 0) + 1;
            }
        });

        if (result.bonus.odds > 0) {
            for (let index = 0; index < result.bonus.odds; index++) {
                const oddsRange = getOddsRange(randomPaylines.length);
                const bonus = chance.integer(oddsRange) * amount;
                summary.bonusAmount += bonus;
                summary.winAmount += bonus;
            }
        }

        if (result.freeSpins.odds > 0) {
            for (let index = 0; index < result.freeSpins.odds; index++) {
                const freeSpinBoard = generator.generate(mode);
                const freeSpinResult = calculator.calculate(freeSpinBoard, randomPaylines, odds);
                const freeSpinAmount =
                    freeSpinResult.paylines
                        .filter((payline) => payline.odds > 0)
                        .reduce((totalAmount, payline) => totalAmount + amount * payline.odds, 0) ?? 0;

                summary.freeSpinAmount += freeSpinAmount;
                summary.winAmount += freeSpinAmount;
            }
        }

        summary.freeSpins += result.freeSpins.odds;
        summary.bonus += result.bonus.odds;
    }

    summary.winLoss = summary.totalAmount - summary.winAmount;
    summary.payoutRatio = `${((summary.winAmount / summary.totalAmount) * 100).toFixed(2)}%`;

    console.log(summary);
}

function runAllModes() {
    console.log("===================EASY===================");
    //runOneMillionsForBots(difficulties.easy);

    console.log("===================MEDIUM===================");
    //runOneMillionsForBots(difficulties.medium);

    console.log("===================HARD===================");
    runOneMillions(difficulties.hard);
}

function runOneMillionsForBots() {
    let totalNumberOfTickets = 0;
    let stakeLevelsTracks = stakeLevelsBotTracks();

    const chance = new Chance();
    const generator = new BoardGenerator();
    const calculator = new PaylineCalculator();
    const paylines = [...Array(25).keys()];
    const jackpotEnabled = true;
    const summary = {
        jackpot: 0,
        freeSpins: 0,
        bonus: 0,
    };

    for (let counter = 0; counter < 1_000_000; counter++) {
        const betAmount = randomBotBetAmount(stakeLevelsTracks, chance, totalNumberOfTickets);
        const track = stakeLevelsTracks.find((track) => track.stake === betAmount);

        const board = generator.generateForBots(jackpotEnabled, track.ratio);
        const result = calculator.calculate(board, paylines, odds);

        if (result.jackpotPayline >= 0) {
            summary.jackpot += 1;

            const track = stakeLevelsTracks.find((track) => track.stake === betAmount);
            track.jackpot++;
        }

        summary.freeSpins += result.freeSpins.odds;
        summary.bonus += result.bonus.odds;

        track.numberOfTickets++;
        totalNumberOfTickets++;
    }

    summary.stakeLevel = stakeLevelsTracks;

    console.log(summary);
}

function stakeLevelsBotTracks() {
    const stakeLevelsConfigs = [
        { stake: 1, botRatio: 20 },
        { stake: 10, botRatio: 20 },
        { stake: 50, botRatio: 60 },
    ];

    return stakeLevelsConfigs.map((config) => {
        return {
            stake: config.stake,
            ratio: config.botRatio,
            numberOfTickets: 0,
            jackpot: 0,
        };
    });
}

function randomBotBetAmount(stakeLevelsTracks, chance, totalNumberOfTickets) {
    const ratiosPerStakeLevel = stakeLevelsTracks.map((track) => {
        return {
            stake: track.stake,
            underRatio: (track.numberOfTickets * 100) / totalNumberOfTickets < track.ratio,
        };
    });

    const underRatioStakeLevels = chance.shuffle(ratiosPerStakeLevel.filter((stakeLevel) => stakeLevel.underRatio));

    if (underRatioStakeLevels.length > 0) {
        return underRatioStakeLevels[0].stake;
    }

    const randomStakeLevelIndex = chance.natural({ min: 0, max: stakeLevelsTracks.length - 1 });

    return stakeLevelsTracks[randomStakeLevelIndex].stake;
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

runAllModes();
