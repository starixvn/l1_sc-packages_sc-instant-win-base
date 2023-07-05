import { BoardGenerator } from "..";
import SlotGameData from "../../slot-game-data";
import defaultDefinition from "../default-definition";
import difficulties from "../difficulties";

describe("BoardGenerator", () => {
    let boardGenerator;
    const gameData = new SlotGameData();

    gameData.gameConfigs = {
        enabled: true,
        minbet: 1,
        maxbet: 1000,
        slotsConfig: {
            stakeLevels: [{ stake: 0.1 }, { stake: 1 }, { stake: 5 }],
            symbolWeight: {
                1: [
                    [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5],
                    [1, 1, 1, 2, 0, 0, 0, 1, 1, 0, 0],
                    [3, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
                ],
                2: [
                    [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5],
                    [1, 1, 1, 2, 0, 0, 0, 1, 1, 0, 0],
                    [1, 1, 2, 0, 1, 0, 0, 0, 0, 0, 0],
                ],
                3: [
                    [55, 50, 45, 40, 35, 30, 25, 20, 15, 10, 5],
                    [1, 1, 1, 2, 2, 2, 2, 1, 1, 0, 0],
                    [1, 1, 2, 0, 1, 0, 0, 0, 0, 0, 0],
                ],
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();

        boardGenerator = new BoardGenerator(defaultDefinition, gameData);
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

});
