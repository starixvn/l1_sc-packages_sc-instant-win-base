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
    it("should generate approriate board base on definition when jackpot enabled", () => {
        // arrange
        const boardGenerator = new BoardGenerator();

        // act
        const board = boardGenerator.generateForBots(true);

        // assert
        expect(board.length).toEqual(defaultDefinition.numberOfRows * defaultDefinition.numberOfColumns);
    });

    it("should generate approriate board base on definition when jackpot disable", () => {
        // arrange
        const boardGenerator = new BoardGenerator();

        // act
        const board = boardGenerator.generateForBots(false);

        // assert
        expect(board.length).toEqual(defaultDefinition.numberOfRows * defaultDefinition.numberOfColumns);
    });
});
