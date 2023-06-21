import _ from "lodash";
import defaultDefinition from "../src/board/default-definition";
import difficulties from "../src/board/difficulties";
import { runOneMillions } from "./run";

function adjustWeight(symbolWeights, summary) {
    const lowPrizedSymbols = [0, 1, 2, 3, 4];
    const selected = summary.symbols.filter((x, index) => lowPrizedSymbols.includes(index));
    const highestWinSymbol = _.maxBy(selected, "winAmount");
    const lowestWinSymbol = _.minBy(selected, "winAmount");

    const highestWinSymbolIndex = summary.symbols.findIndex((x) => x === highestWinSymbol);
    if (symbolWeights[highestWinSymbolIndex] > 1) {
        symbolWeights[highestWinSymbolIndex] -= 1;
    }

    const lowestWinSymbolIndex = summary.symbols.findIndex((x) => x === lowestWinSymbol);
    symbolWeights[lowestWinSymbolIndex] += 1;

    if ((summary.symbols[defaultDefinition.specialSymbols.freeSpins].winAmount * 100) / summary.winAmount > 1.5) {
        symbolWeights[defaultDefinition.specialSymbols.freeSpins] -= 0.5;
    }

    if ((summary.symbols[defaultDefinition.specialSymbols.freeSpins].winAmount * 100) / summary.winAmount < 1) {
        symbolWeights[defaultDefinition.specialSymbols.freeSpins] += 0.5;
    }

    if ((summary.symbols[defaultDefinition.specialSymbols.bonus].winAmount * 100) / summary.winAmount > 1.5) {
        symbolWeights[defaultDefinition.specialSymbols.bonus] -= 0.5;
    }

    if ((summary.symbols[defaultDefinition.specialSymbols.bonus].winAmount * 100) / summary.winAmount < 1) {
        symbolWeights[defaultDefinition.specialSymbols.bonus] += 0.5;
    }

    if ((summary.symbols[5].winAmount * 100) / summary.winAmount > 1) {
        symbolWeights[5] -= 0.5;
    }

    if ((summary.symbols[5].winAmount * 100) / summary.winAmount < 0.5) {
        symbolWeights[5] += 0.5;
    }

    if ((summary.symbols[6].winAmount * 100) / summary.winAmount > 1) {
        symbolWeights[6] -= 0.5;
    }

    if ((summary.symbols[6].winAmount * 100) / summary.winAmount < 0.5) {
        symbolWeights[6] += 0.5;
    }

    if (summary.wilds > 40) {
        symbolWeights[defaultDefinition.specialSymbols.replacement] -= 0.5;
    }

    if (summary.wilds < 30) {
        symbolWeights[defaultDefinition.specialSymbols.replacement] += 0.5;
    }
}

function bruteForce() {
    const mode = difficulties.easy;
    const boardDefinition = { ...defaultDefinition };
    let summary;
    let first = true;
    const suggestedWeights = [];

    do {
        if (!first) {
            adjustWeight(boardDefinition.fillingStrategies.easy, summary);
        }
        first = false;

        summary = runOneMillions(mode, boardDefinition);
        console.log(`${summary.payoutRatio} with weight ${boardDefinition.fillingStrategies.easy}`);

        if (summary.payoutRatio >= 95 && summary.payoutRatio <= 99) {
            suggestedWeights.push(boardDefinition.fillingStrategies.easy);
        }
    } while (suggestedWeights.length < 5);

    console.log(`mode ${mode}`);
    console.log(suggestedWeights);
}

bruteForce();
