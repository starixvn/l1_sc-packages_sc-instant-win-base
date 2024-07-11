import { boardGenerator, boardCheatingConsumer, paylineCalculator, bonusBoardGenerator } from "./stubs";
import GenerateResultConsumer from "./../generate-result-consumer";

describe("GenerateResultConsumer", () => {
    let consumer;
    let definitionMock;
    let gameDataMock;

    beforeEach(() => {
        jest.clearAllMocks();

        definitionMock = {};
        gameDataMock = {
            gameConfigs: {
                slotsConfig: {
                    mode: "normal",
                },
            },
        };

        consumer = new GenerateResultConsumer({
            definition: definitionMock,
            gameData: gameDataMock,
            boardGenerator,
            bonusBoardGenerator,
            paylineCalculator,
            boardCheatingConsumer,
        });
    });

    describe("generateResult", () => {
        const playerName = "player1";
        const mode = "normal";
        const generatedBoard = { board: "board1" };
        const consumedBoard = { consumedBoard: "consumedBoard1" };

        it("should generate board with mode", () => {
            // Arrange
            boardGenerator.generate.mockReturnValueOnce(generatedBoard);
            boardCheatingConsumer.consume.mockReturnValueOnce(consumedBoard);

            // Act
            consumer.generateResult(playerName);

            // Assert
            expect(boardGenerator.generate).toHaveBeenCalledWith(mode);
        });

        it("should pass generated board to control result", () => {
            // Arrange
            boardGenerator.generate.mockReturnValueOnce(generatedBoard);
            boardCheatingConsumer.consume.mockReturnValueOnce(consumedBoard);

            // Act
            consumer.generateResult(playerName);

            // Assert
            expect(boardCheatingConsumer.consume).toHaveBeenCalledWith(playerName, generatedBoard);
        });

        it("should return result from boardCheatingConsumer", () => {
            // Arrange
            boardGenerator.generate.mockReturnValueOnce(generatedBoard);
            boardCheatingConsumer.consume.mockReturnValueOnce(consumedBoard);

            // Act
            const result = consumer.generateResult(playerName);

            // Assert
            expect(result).toEqual(consumedBoard);
            expect(boardGenerator.generate).toHaveBeenCalledWith(mode);
            expect(boardCheatingConsumer.consume).toHaveBeenCalledWith(playerName, generatedBoard);
        });
    });

    describe("settleWinningPaylines", () => {
        describe("when have jackpot", () => {
            it("should settle winning paylines exclude jackpot payline", () => {
                // Arrange
                const settlementResult = {
                    paylines: [
                        { payline: "payline1", odds: 2 },
                        { payline: "payline2", odds: 0 },
                        { payline: "payline3", odds: 3 },
                    ],
                    jackpot: true,
                    jackpotPayline: "payline3",
                };

                // Act
                const winningPaylines = consumer.settleWinningPaylines(settlementResult);

                // Assert
                expect(winningPaylines).toEqual([{ payline: "payline1", odds: 2 }]);
            });
        });

        describe("when have NO jackpot", () => {
            it("should settle all winning paylines", () => {
                // Arrange
                const settlementResult = {
                    paylines: [
                        { payline: "payline1", odds: 2 },
                        { payline: "payline2", odds: 0 },
                        { payline: "payline3", odds: 3 },
                    ],
                    jackpot: false,
                };

                // Act
                const winningPaylines = consumer.settleWinningPaylines(settlementResult);

                // Assert
                expect(winningPaylines).toEqual([
                    { payline: "payline1", odds: 2 },
                    { payline: "payline3", odds: 3 },
                ]);
            });
        });
    });

    describe("generateSettlementResult", () => {
        const bet = {
            name: "player1",
            paylines: ["payline1", "payline2"],
        };
        const odds = 2;
        const generatedBoard = { board: "board1" };
        const consumedBoard = { consumedBoard: "consumedBoard1" };
        const calculatedResult = {
            paylines: [
                { payline: "payline1", odds: 2 },
                { payline: "payline2", odds: 0 },
            ],
            jackpot: false,
        };

        beforeEach(() => {
            boardGenerator.generate.mockReturnValueOnce(generatedBoard);
            boardCheatingConsumer.consume.mockReturnValueOnce(consumedBoard);
            paylineCalculator.calculate.mockReturnValueOnce(calculatedResult);
        });

        it("always generate result with player name", () => {
            // Arrange
            jest.spyOn(consumer, "generateResult");

            // Act
            consumer.generateSettlementResult(bet, odds);

            // Assert
            expect(consumer.generateResult).toHaveBeenCalledWith(bet.name);
        });

        it("always calculate from generated result", () => {
            // Arrange

            // Act
            consumer.generateSettlementResult(bet, odds);

            // Assert
            expect(paylineCalculator.calculate).toHaveBeenCalledWith(consumedBoard, bet.paylines, odds);
        });

        it("always settle winning from settlement result", () => {
            // Arrange
            jest.spyOn(consumer, "settleWinningPaylines");

            // Act
            consumer.generateSettlementResult(bet, odds);

            // Assert
            expect(consumer.settleWinningPaylines).toHaveBeenCalledWith(calculatedResult);
        });

        it("should generate settlement result correctly", () => {
            // Arrange

            // Act
            const { result, settlementResult } = consumer.generateSettlementResult(bet, odds);

            // Assert
            expect(result).toEqual(consumedBoard);
            expect(settlementResult).toEqual({
                ...calculatedResult,
                winningPaylines: [{ payline: "payline1", odds: 2 }],
            });
        });
    });
});
