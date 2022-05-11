import { BoardGenerator } from "..";
import defaultDefinition from "../default-definition";
import difficulties from "../difficulties";

describe("BoardGenerator", () => {
    let boardGenerator;

    beforeEach(() => {
        jest.clearAllMocks();

        boardGenerator = new BoardGenerator();
    });

    describe("generate", () => {
        it("should generate approriate board base on definition", () => {
            // Act
            const board = boardGenerator.generate(difficulties.easy);

            // Assert
            expect(board.length).toEqual(defaultDefinition.numberOfRows * defaultDefinition.numberOfColumns);
        });
    });

    describe("generateForBots", () => {
        describe("when jackpot enabled", () => {
            it("should generate appropriate board base on definition ", () => {
                // Act
                const board = boardGenerator.generateForBots(true);

                // Assert
                expect(board.length).toEqual(defaultDefinition.numberOfRows * defaultDefinition.numberOfColumns);
            });
        });

        describe("when jackpot disable", () => {
            it("should generate appropriate board base on definition ", () => {
                // Act
                const board = boardGenerator.generateForBots(false);

                // Assert
                expect(board.length).toEqual(defaultDefinition.numberOfRows * defaultDefinition.numberOfColumns);
            });
        });
    });

    describe("buildSymbolPossibilities", () => {
        const testCases = [{ possibilityRange: 0 }, { possibilityRange: -1 }];

        it.each(testCases)("when possibilityRange <= 0 should return empty ", (testCase) => {
            // Act
            const ActualValue = boardGenerator.buildSymbolPossibilities(testCase.possibilityRange);

            // Assert
            expect(ActualValue).toStrictEqual([]);
        });
    });

    describe(" getFillingStrategy", () => {
        const testCases = [
            { difficulty: 3, expectedValue: defaultDefinition.fillingStrategies.hard },
            { difficulty: 2, expectedValue: defaultDefinition.fillingStrategies.medium },
            { difficulty: 1, expectedValue: defaultDefinition.fillingStrategies.easy },
        ];
        it.each(testCases)("should return correct fillingStrategies", (testCase) => {
            // Act
            const ActualValue = boardGenerator.getFillingStrategy(testCase.difficulty);

            // Assert
            expect(ActualValue).toStrictEqual(testCase.expectedValue);
        });
    });
});
