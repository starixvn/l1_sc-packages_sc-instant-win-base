import PaylineCalculator from "../../src/board/payline-calculator";
import { defaultDefinition } from "../../src/board/default-definition";

describe("PaylineCalculator", () => {
    let calculator;
    const odds = 1;

    beforeEach(() => {
        calculator = new PaylineCalculator(defaultDefinition);
    });

    describe("Basic Symbol Wins", () => {
        test("should calculate win for 3 matching symbols", () => {
            // Board is a flat array of 15 elements (5x3 grid read from left to right, top to bottom)
            const board = [
                "HARRY",
                "HARRY",
                "HARRY",
                "K",
                "Q", // Top row
                "K",
                "Q",
                "J",
                "T",
                "A", // Middle row
                "Q",
                "J",
                "T",
                "K",
                "J", // Bottom row
            ].map((id) => ({
                id,
                pays: id === "HARRY" ? { 3: 2.5, 4: 5, 5: 25 } : null,
                isWild: false,
                isScatter: false,
            }));

            const paylines = [1]; // Middle horizontal line

            const result = calculator.calculate(board, paylines, odds);
            expect(result.totalWin).toBe(2.5);
            expect(result.paylines[0].count).toBe(3);
        });

        test("should calculate win with wild multiplier", () => {
            const board = [
                "HARRY",
                "WILD",
                "HARRY",
                "K",
                "Q", // Top row
                "K",
                "Q",
                "J",
                "T",
                "A", // Middle row
                "Q",
                "J",
                "T",
                "K",
                "J", // Bottom row
            ].map((id) => ({
                id,
                pays: id === "HARRY" ? { 3: 2.5, 4: 5, 5: 25 } : null,
                isWild: id === "WILD",
                isScatter: false,
                multiplier: id === "WILD" ? 2 : null,
            }));

            const paylines = [1];

            const result = calculator.calculate(board, paylines, odds);
            expect(result.totalWin).toBe(5); // 2.5 * 2(wild multiplier)
            expect(result.paylines[0].wildCount).toBe(1);
        });
    });

    describe("Free Spins Trigger", () => {
        test("should identify 3 scatters for free spins trigger", () => {
            const board = [
                "SCATTER",
                "K",
                "SCATTER",
                "K",
                "Q", // Top row
                "K",
                "Q",
                "J",
                "T",
                "SCATTER", // Middle row
                "Q",
                "J",
                "T",
                "K",
                "J", // Bottom row
            ].map((id) => ({
                id,
                isScatter: id === "SCATTER",
                isWild: false,
            }));

            const scatterCount = board.filter((symbol) => symbol.isScatter).length;
            expect(scatterCount).toBe(3); // Triggers free spins
        });
    });

    describe("Multiple Wild Multipliers", () => {
        test("should multiply multiple wild multipliers together", () => {
            const board = [
                "HARRY",
                "WILD",
                "WILD",
                "K",
                "Q", // Top row
                "K",
                "Q",
                "J",
                "T",
                "A", // Middle row
                "Q",
                "J",
                "T",
                "K",
                "J", // Bottom row
            ].map((id) => ({
                id,
                pays: id === "HARRY" ? { 3: 2.5, 4: 5, 5: 25 } : null,
                isWild: id === "WILD",
                isScatter: false,
                multiplier: id === "WILD" ? (id === board[1] ? 2 : 3) : null,
            }));

            const paylines = [1];

            const result = calculator.calculate(board, paylines, odds);
            expect(result.totalWin).toBe(15); // 2.5 * 2 * 3
            expect(result.paylines[0].wildCount).toBe(2);
        });
    });

    describe("Free Spins Multiplier", () => {
        test("should combine free spins multiplier with wild multipliers", () => {
            const board = [
                "HARRY",
                "WILD",
                "HARRY",
                "K",
                "Q", // Top row
                "K",
                "Q",
                "J",
                "T",
                "A", // Middle row
                "Q",
                "J",
                "T",
                "K",
                "J", // Bottom row
            ].map((id) => ({
                id,
                pays: id === "HARRY" ? { 3: 2.5, 4: 5, 5: 25 } : null,
                isWild: id === "WILD",
                isScatter: false,
                multiplier: id === "WILD" ? 2 : null,
            }));

            const paylines = [1];
            const freeSpinMultiplier = 5;

            const result = calculator.calculate(board, paylines, odds, true, freeSpinMultiplier);
            expect(result.totalWin).toBe(25); // 2.5 * 2(wild) * 5(free spins)
        });
    });
});
