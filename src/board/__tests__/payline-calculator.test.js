import PaylineCalculator from "../payline-calculator";
import defaultDefinition from "../default-definition";
import { boards } from "./test-boards";

describe("PaylineCalculator", () => {
    let calculator;

    beforeEach(() => {
        calculator = new PaylineCalculator(defaultDefinition);
    });

    test("should calculate basic win", () => {
        const result = calculator.calculate(boards.threeHarry, [[0, 1, 2, 3, 4]], 1);

        expect(result.paylines[0].symbol).toBe("HARRY");
        expect(result.paylines[0].count).toBe(3);
        expect(result.totalWin).toBe(2.5);
    });

    test("should calculate win with wild multiplier", () => {
        const result = calculator.calculate(boards.threeHarryWithWild, [[0, 1, 2, 3, 4]], 1);

        expect(result.paylines[0].symbol).toBe("HARRY");
        expect(result.paylines[0].count).toBe(3);
        expect(result.paylines[0].multiplier).toBe(2);
        expect(result.totalWin).toBe(5);
    });

    test("should calculate 4-symbol win", () => {
        const result = calculator.calculate(boards.fourHarry, [[0, 1, 2, 3, 4]], 1);

        expect(result.paylines[0].symbol).toBe("HARRY");
        expect(result.paylines[0].count).toBe(4);
        expect(result.totalWin).toBe(5);
    });

    test("should calculate 5-symbol win", () => {
        const result = calculator.calculate(boards.fiveHarry, [[0, 1, 2, 3, 4]], 1);

        expect(result.paylines[0].symbol).toBe("HARRY");
        expect(result.paylines[0].count).toBe(5);
        expect(result.totalWin).toBe(25);
    });

    test("should calculate 4-symbol win with wild multiplier", () => {
        const result = calculator.calculate(boards.fourHarryWithWild, [[0, 1, 2, 3, 4]], 1);

        expect(result.paylines[0].symbol).toBe("HARRY");
        expect(result.paylines[0].count).toBe(4);
        expect(result.paylines[0].multiplier).toBe(2);
        expect(result.totalWin).toBe(10);
    });

    test("should calculate 5-symbol win with multiple wild multipliers", () => {
        const result = calculator.calculate(boards.fiveHarryWithMultipleWilds, [[0, 1, 2, 3, 4]], 1);

        expect(result.paylines[0].symbol).toBe("HARRY");
        expect(result.paylines[0].count).toBe(5);
        expect(result.paylines[0].multiplier).toBe(6);
        expect(result.totalWin).toBe(150);
    });

    describe("when player has free spins", () => {
        test("should apply free spins multiplier to basic win", () => {
            const result = calculator.calculate(boards.threeHarry, [[0, 1, 2, 3, 4]], 1, true, 3);

            expect(result.paylines[0].symbol).toBe("HARRY");
            expect(result.paylines[0].count).toBe(3);
            expect(result.paylines[0].multiplier).toBe(3);
            expect(result.totalWin).toBe(7.5);
        });

        test("should combine wild and free spins multipliers", () => {
            const result = calculator.calculate(boards.threeHarryWithWild, [[0, 1, 2, 3, 4]], 1, true, 3);

            expect(result.paylines[0].symbol).toBe("HARRY");
            expect(result.paylines[0].count).toBe(3);
            expect(result.paylines[0].multiplier).toBe(6);
            expect(result.totalWin).toBe(15);
        });

        test("should calculate 4-symbol win with free spins multiplier", () => {
            const result = calculator.calculate(boards.fourHarry, [[0, 1, 2, 3, 4]], 1, true, 3);

            expect(result.paylines[0].symbol).toBe("HARRY");
            expect(result.paylines[0].count).toBe(4);
            expect(result.paylines[0].multiplier).toBe(3);
            expect(result.totalWin).toBe(15);
        });

        test("should calculate 5-symbol win with free spins multiplier", () => {
            const result = calculator.calculate(boards.fiveHarry, [[0, 1, 2, 3, 4]], 1, true, 3);

            expect(result.paylines[0].symbol).toBe("HARRY");
            expect(result.paylines[0].count).toBe(5);
            expect(result.paylines[0].multiplier).toBe(3);
            expect(result.totalWin).toBe(75);
        });

        test("should calculate 4-symbol win with wild and free spins multipliers", () => {
            const result = calculator.calculate(boards.fourHarryWithWild, [[0, 1, 2, 3, 4]], 1, true, 3);

            expect(result.paylines[0].symbol).toBe("HARRY");
            expect(result.paylines[0].count).toBe(4);
            expect(result.paylines[0].multiplier).toBe(6);
            expect(result.totalWin).toBe(30);
        });

        test("should calculate 5-symbol win with multiple wild and free spins multipliers", () => {
            const result = calculator.calculate(boards.fiveHarryWithMultipleWilds, [[0, 1, 2, 3, 4]], 1, true, 3);

            expect(result.paylines[0].symbol).toBe("HARRY");
            expect(result.paylines[0].count).toBe(5);
            expect(result.paylines[0].multiplier).toBe(18);
            expect(result.totalWin).toBe(450);
        });
    });

    describe("when player got NO wins", () => {
        test("should handle no matching symbols", () => {
            const result = calculator.calculate(boards.noWin, [[0, 1, 2, 3, 4]], 1);

            expect(result.paylines[0].symbol).toBeNull();
            expect(result.paylines[0].count).toBe(0);
            expect(result.paylines[0].multiplier).toBe(1);
            expect(result.paylines[0].win).toBe(0);
            expect(result.totalWin).toBe(0);
        });

        test("should handle only two matching symbols", () => {
            const result = calculator.calculate(boards.twoMatchOnly, [[0, 1, 2, 3, 4]], 1);

            expect(result.paylines[0].symbol).toBeNull();
            expect(result.paylines[0].count).toBe(0);
            expect(result.paylines[0].multiplier).toBe(1);
            expect(result.paylines[0].win).toBe(0);
            expect(result.totalWin).toBe(0);
        });

        test("should handle empty paylines array", () => {
            const result = calculator.calculate(boards.threeHarry, [], 1);

            expect(result.paylines).toHaveLength(0);
            expect(result.totalWin).toBe(0);
        });

        test("should handle no wins during free spins", () => {
            const result = calculator.calculate(boards.noWin, [[0, 1, 2, 3, 4]], 1, true, 3);

            expect(result.paylines[0].symbol).toBeNull();
            expect(result.paylines[0].count).toBe(0);
            expect(result.paylines[0].multiplier).toBe(1);
            expect(result.paylines[0].win).toBe(0);
            expect(result.totalWin).toBe(0);
        });
    });
});
