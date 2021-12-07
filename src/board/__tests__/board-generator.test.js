import { BoardGenerator } from "..";
import defaultDefinition from "../default-definition";
import difficulties from "../difficulties";

describe("generate", () => {
    it("should generate approriate board base on definition", () => {
        // arrange
        const boardGenerator = new BoardGenerator();

        // act
        const board = boardGenerator.generate(difficulties.easy);

        // assert
        expect(board.length).toEqual(defaultDefinition.numberOfRows * defaultDefinition.numberOfColumns);
    });
});

describe("generateForBots", () => {
    it("should generate appropriate board base on definition when jackpot enabled", () => {
        // arrange
        const boardGenerator = new BoardGenerator();

        // act
        const board = boardGenerator.generateForBots(true);

        // assert
        expect(board.length).toEqual(defaultDefinition.numberOfRows * defaultDefinition.numberOfColumns);
    });

    it("should generate appropriate board base on definition when jackpot disable", () => {
        // arrange
        const boardGenerator = new BoardGenerator();

        // act
        const board = boardGenerator.generateForBots(false);

        // assert
        expect(board.length).toEqual(defaultDefinition.numberOfRows * defaultDefinition.numberOfColumns);
    });
});

describe("buildSymbolPossibilities", () => {
    const testCases = [{ possibilityRange: 0 }, { possibilityRange: -1 }];

    it.each(testCases)("when possibilityRange <= 0 should return empty ", (testCase) => {
        // arrange
        const boardGenerator = new BoardGenerator();

        // act
        const actualValue = boardGenerator.buildSymbolPossibilities(testCase.possibilityRange);

        // assert
        expect(actualValue).toStrictEqual([]);
    });
});

describe(" getFillingStrategy", () => {
    const testCases = [
        { difficulty: 3, expectedValue: defaultDefinition.fillingStrategies.hard },
        { difficulty: 2, expectedValue: defaultDefinition.fillingStrategies.medium },
        { difficulty: 1, expectedValue: defaultDefinition.fillingStrategies.easy },
    ];
    it.each(testCases)("should return correct fillingStrategies", (testCase) => {
        // arrange
        const boardGenerator = new BoardGenerator();

        // act
        const actualValue = boardGenerator.getFillingStrategy(testCase.difficulty);

        // assert
        expect(actualValue).toStrictEqual(testCase.expectedValue);
    });
});
