import { boardGenerator, boardCheatingConsumer, paylineCalculator, bonusBoardGenerator, jackpotPrizeGenerator } from "./stubs";
import GenerateResultConsumer from "./../generate-result-consumer";

import { boards } from "../../board/__tests__/test-boards";
import defaultDefinition from "../../board/default-definition";

const TEST_PLAYER_NAME = "testPlayer";

describe("GenerateResultConsumer", () => {
    let consumer;
    let mockBoardGenerator;
    let mockBoardCheatingConsumer;
    let mockPaylineCalculator;
    let mockGameData;

    beforeEach(() => {
        mockBoardGenerator = {
            generate: jest.fn(),
        };
        mockBoardCheatingConsumer = {
            consume: jest.fn(),
        };
        mockPaylineCalculator = {
            calculate: jest.fn(),
        };
        mockGameData = {
            gameConfigs: {
                slotsConfig: {
                    mode: "normal",
                },
            },
        };

        consumer = new GenerateResultConsumer({
            gameData: mockGameData,
            boardGenerator: mockBoardGenerator,
            boardCheatingConsumer: mockBoardCheatingConsumer,
            paylineCalculator: mockPaylineCalculator,
        });
    });

    describe("generateResult", () => {
        it("should generate regular board and apply cheating rules", () => {
            mockBoardGenerator.generate.mockReturnValue(boards.noWin);
            mockBoardCheatingConsumer.consume.mockReturnValue(boards.threeHarry);

            const result = consumer.generateResult(TEST_PLAYER_NAME);

            expect(mockBoardGenerator.generate).toHaveBeenCalledWith("normal");
            expect(mockBoardCheatingConsumer.consume).toHaveBeenCalledWith(TEST_PLAYER_NAME, boards.noWin);
            expect(result).toEqual(boards.threeHarry);
        });

        it("should handle free spins mode", () => {
            mockGameData.gameConfigs.slotsConfig.mode = "free";
            mockBoardGenerator.generate.mockReturnValue(boards.noWin);
            mockBoardCheatingConsumer.consume.mockReturnValue(boards.noWin);

            consumer.generateResult(TEST_PLAYER_NAME);

            expect(mockBoardGenerator.generate).toHaveBeenCalledWith("free");
        });

        it("should generate board with wild symbols", () => {
            mockBoardGenerator.generate.mockReturnValue(boards.threeHarryWithWild);
            mockBoardCheatingConsumer.consume.mockReturnValue(boards.threeHarryWithWild);

            const result = consumer.generateResult(TEST_PLAYER_NAME);

            expect(result).toEqual(boards.threeHarryWithWild);
        });
    });

    describe("settleWinningPaylines", () => {
        it("should filter and return only paylines with odds greater than 0", () => {
            const settlementResult = {
                paylines: [
                    { payline: defaultDefinition.paylines[0], symbol: "HARRY", count: 3, odds: 2.5 },
                    { payline: defaultDefinition.paylines[1], symbol: "K", count: 2, odds: 0 },
                    { payline: defaultDefinition.paylines[2], symbol: "WILD", count: 3, odds: 5 },
                ],
                freeSpins: { count: 0, odds: 0 },
                bonus: { count: 0, odds: 0 },
            };

            const winningPaylines = consumer.settleWinningPaylines(settlementResult);

            expect(winningPaylines).toEqual([
                { payline: defaultDefinition.paylines[0], symbol: "HARRY", count: 3, odds: 2.5 },
                { payline: defaultDefinition.paylines[2], symbol: "WILD", count: 3, odds: 5 },
            ]);
        });

        it("should return empty array when no winning paylines", () => {
            const settlementResult = {
                paylines: [
                    { payline: defaultDefinition.paylines[0], symbol: "K", count: 2, odds: 0 },
                    { payline: defaultDefinition.paylines[1], symbol: "Q", count: 2, odds: 0 },
                ],
                freeSpins: { count: 0, odds: 0 },
                bonus: { count: 0, odds: 0 },
            };

            const winningPaylines = consumer.settleWinningPaylines(settlementResult);

            expect(winningPaylines).toEqual([]);
        });
    });

    describe("generateSettlementResult", () => {
        const setupBasicTest = () => {
            const bet = {
                name: "player1",
                paylines: ["payline1", "payline2"],
            };
            const odds = 2;
            const mockCalculateResult = {
                paylines: [
                    { payline: 1, symbol: "1", count: 3, odds: 5 },
                    { payline: 2, symbol: "10", count: 5, odds: 500 },
                    { payline: 3, symbol: "2", count: 3, odds: 5 },
                ],
                freeSpins: { count: 1, odds: 0 },
                bonus: { count: 0, odds: 0 },
                jackpotPayline: -1,
            };
            return { bet, odds, mockCalculateResult };
        };

        it("always generate result with player name", () => {
            const { bet, odds, mockCalculateResult } = setupBasicTest();
            jest.spyOn(consumer, "generateResult");
            mockPaylineCalculator.calculate.mockReturnValue(mockCalculateResult);

            consumer.generateSettlementResult({ name: bet.name }, bet, odds);

            expect(consumer.generateResult).toHaveBeenCalledWith(bet.name);
        });

        it("always calculate from generated result", () => {
            const { bet, odds, mockCalculateResult } = setupBasicTest();
            const generatedBoard = boards.noWin;
            mockBoardGenerator.generate.mockReturnValue(generatedBoard);
            mockBoardCheatingConsumer.consume.mockReturnValue(boards.threeHarry);
            mockPaylineCalculator.calculate.mockReturnValue(mockCalculateResult);

            consumer.generateSettlementResult({ name: bet.name }, bet, odds);

            expect(mockPaylineCalculator.calculate).toHaveBeenCalledWith(boards.threeHarry, bet.paylines, odds);
        });

        it("always settle winning from settlement result", () => {
            const { bet, odds, mockCalculateResult } = setupBasicTest();
            jest.spyOn(consumer, "settleWinningPaylines");
            mockPaylineCalculator.calculate.mockReturnValue(mockCalculateResult);

            consumer.generateSettlementResult({ name: bet.name }, bet, odds);

            expect(consumer.settleWinningPaylines).toHaveBeenCalledWith(mockCalculateResult);
        });

        it("should generate settlement result correctly", () => {
            const { bet, odds, mockCalculateResult } = setupBasicTest();
            mockBoardGenerator.generate.mockReturnValue(boards.noWin);
            mockBoardCheatingConsumer.consume.mockReturnValue(boards.threeHarry);
            mockPaylineCalculator.calculate.mockReturnValue(mockCalculateResult);

            const { result, settlementResult } = consumer.generateSettlementResult({ name: bet.name }, bet, odds);

            expect(result).toEqual(boards.threeHarry);
            expect(settlementResult).toEqual({
                ...mockCalculateResult,
                winningPaylines: mockCalculateResult.paylines.filter((payline) => payline.odds > 0),
            });
        });

        it("should handle realistic board configurations", () => {
            const realisticBet = {
                name: TEST_PLAYER_NAME,
                paylines: defaultDefinition.paylines,
            };

            const realisticCalculateResult = {
                paylines: [{ payline: defaultDefinition.paylines[0], symbol: "HARRY", count: 3, odds: 2.5 }],
                freeSpins: { count: 0, odds: 0 },
                bonus: { count: 0, odds: 0 },
                jackpotPayline: -1,
            };

            mockBoardGenerator.generate.mockReturnValue(boards.noWin);
            mockBoardCheatingConsumer.consume.mockReturnValue(boards.threeHarry);
            mockPaylineCalculator.calculate.mockReturnValue(realisticCalculateResult);

            const result = consumer.generateSettlementResult({ name: realisticBet.name }, realisticBet, 2);

            expect(result.result).toEqual(boards.threeHarry);
            expect(result.settlementResult.winningPaylines[0].symbol).toBe("HARRY");
        });
    });
});
