import { boardGenerator, boardCheatingConsumer, paylineCalculator, bonusBoardGenerator, jackpotPrizeGenerator } from "./stubs";
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
            jackpotPrizeGenerator,
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
        const generatedBoard = [10, 5, 4, 10, 8, 7, 10, 5, 8, 10, 0, 8, 10, 5, 0];
        const consumedBoard = [2, 1, 5, 10, 8, 7, 10, 5, 8, 10, 0, 0, 0, 5, 0];
        const paylines = [
            { payline: 1, symbol: "1", count: 3, odds: 5 },
            { payline: 2, symbol: "10", count: 5, odds: 500 },
            { payline: 3, symbol: "2", count: 3, odds: 5 },
        ];
        const calculatedResult = {
            paylines,
            freeSpins: { count: 1, odds: 0 },
            bonus: { count: 0, odds: 0 },
            jackpotPayline: -1,
        };

        const player = { name: "player1" };

        beforeEach(() => {
            boardGenerator.generate.mockReturnValueOnce(generatedBoard);
            boardCheatingConsumer.consume.mockReturnValueOnce(consumedBoard);
        });

        it("always generate result with player name", () => {
            // Arrange
            jest.spyOn(consumer, "generateResult");
            paylineCalculator.calculate.mockReturnValueOnce(calculatedResult);

            // Act
            consumer.generateSettlementResult(player, bet, odds);

            // Assert
            expect(consumer.generateResult).toHaveBeenCalledWith(bet.name);
        });

        it("always calculate from generated result", () => {
            // Arrange
            paylineCalculator.calculate.mockReturnValueOnce(calculatedResult);

            // Act
            consumer.generateSettlementResult(player, bet, odds);

            // Assert
            expect(paylineCalculator.calculate).toHaveBeenCalledWith(consumedBoard, bet.paylines, odds);
        });

        it("always settle winning from settlement result", () => {
            // Arrange
            jest.spyOn(consumer, "settleWinningPaylines");
            paylineCalculator.calculate.mockReturnValueOnce(calculatedResult);

            // Act
            consumer.generateSettlementResult(player, bet, odds);

            // Assert
            expect(consumer.settleWinningPaylines).toHaveBeenCalledWith(calculatedResult);
        });

        it("should generate settlement result correctly", () => {
            // Arrange
            paylineCalculator.calculate.mockReturnValueOnce(calculatedResult);

            // Act
            const { result, settlementResult } = consumer.generateSettlementResult(player, bet, odds);

            // Assert
            expect(result).toEqual(consumedBoard);
            expect(settlementResult).toEqual({
                ...calculatedResult,
                winningPaylines: paylines,
            });
        });

        describe("when have jackpot", () => {
            it("should return result contain correct jackpot info ", () => {
                // Arrange
                const prizes = ["minor", "major", "grand"];
                const resultWithJackpot = { ...calculatedResult };
                resultWithJackpot.jackpotPayline = 2;
                paylineCalculator.calculate.mockReturnValueOnce(resultWithJackpot);
                jackpotPrizeGenerator.generate.mockReturnValueOnce(prizes);

                // Act
                const { settlementResult } = consumer.generateSettlementResult(player, bet, odds);

                // Assert
                expect(settlementResult.jackpot).toStrictEqual({
                    picked: false,
                    prizes,
                    winningLine: resultWithJackpot.jackpotPayline,
                    winningAmount: 0,
                });
            });

            it("should exlcude jackpot payline from winningPaylines ", () => {
                // Arrange
                const prizes = ["minor", "major", "grand"];
                const resultWithJackpot = { ...calculatedResult };
                resultWithJackpot.jackpotPayline = 2;
                paylineCalculator.calculate.mockReturnValueOnce(resultWithJackpot);
                jackpotPrizeGenerator.generate.mockReturnValueOnce(prizes);

                // Act
                const { settlementResult } = consumer.generateSettlementResult(player, bet, odds);

                // Assert
                expect(settlementResult.winningPaylines.filter((payline) => payline.payline === resultWithJackpot.jackpotPayline)).toBeEmpty();
            });
        });

        describe("when NOT have jackpot", () => {
            it("should NOT return jackpot", () => {
                // Arrange
                paylineCalculator.calculate.mockReturnValueOnce(calculatedResult);

                // Act
                const { settlementResult } = consumer.generateSettlementResult(player, bet, odds);

                // Assert
                expect(settlementResult.jackpot).toBeUndefined();
            });

            it("should return all winning paylines", () => {
                // Arrange
                paylineCalculator.calculate.mockReturnValueOnce(calculatedResult);

                // Act
                const { settlementResult } = consumer.generateSettlementResult(player, bet, odds);

                // Assert
                expect(settlementResult.winningPaylines).toStrictEqual(paylines);
            });
        });
    });
});
