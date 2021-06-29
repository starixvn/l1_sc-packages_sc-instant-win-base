import { PaylineCalculator } from "..";
import odds from "../../../tests/odds";

describe("generate", () => {
    it("should return approriate odds for winning paylines", () => {
        // arrange
        const board = [1, 2, 2, 1, 4, 4, 1, 9, 3, 4, 1, 2, 7, 2, 2];
        const selectedPaylines = [1];
        const calculator = new PaylineCalculator();
        const expectedCount = 3;
        const expectedPaylines = [{ payline: 1, count: expectedCount, odds: odds[1][expectedCount], symbol: "1" }];

        // act
        const settlementResult = calculator.calculate(board, selectedPaylines, odds);

        // assert
        expect(settlementResult).not.toBeNull();
        expect(settlementResult.paylines).toStrictEqual(expectedPaylines);
        expect(settlementResult.bonus).toStrictEqual({ count: 0, odds: 0 });
    });

    it("should return bonus when having more than 3 bonus on different columns", () => {
        // arrange
        const board = [1, 2, 2, 1, 4, 8, 1, 8, 3, 4, 1, 8, 7, 2, 2];
        const selectedPaylines = [1];
        const calculator = new PaylineCalculator();

        // act
        const settlementResult = calculator.calculate(board, selectedPaylines, odds);

        // assert
        expect(settlementResult.bonus).toStrictEqual({ count: 3, odds: 3 });
    });

    it("should NOT treat wild icon as replacement of bonus", () => {
        // arrange
        const board = [1, 1, 2, 1, 9, 7, 8, 1, 3, 4, 8, 7, 7, 2, 2];
        const selectedPaylines = [1];
        const calculator = new PaylineCalculator();

        // act
        const settlementResult = calculator.calculate(board, selectedPaylines, odds);

        // assert
        expect(settlementResult.bonus).toStrictEqual({ count: 2, odds: 0 });
    });

    it("should return freespins when having more than 3 freespins on different columns", () => {
        // arrange
        const board = [1, 2, 2, 1, 4, 7, 1, 8, 3, 4, 1, 7, 7, 2, 2];
        const selectedPaylines = [1];
        const calculator = new PaylineCalculator();

        // act
        const settlementResult = calculator.calculate(board, selectedPaylines, odds);

        // assert
        expect(settlementResult.freeSpins).toStrictEqual({ count: 3, odds: 3 });
    });

    it("should return JACKPOT if payline contains 5 jackpot symbol", () => {
        // arrange
        const board = [10, 2, 2, 10, 4, 4, 10, 9, 3, 10, 1, 2, 10, 2, 2];
        const selectedPaylines = [1];
        const calculator = new PaylineCalculator();
        const expectedCount = 5;
        const expectedPaylines = [{ payline: 1, count: expectedCount, odds: odds[10][expectedCount], symbol: "10" }];

        // act
        const settlementResult = calculator.calculate(board, selectedPaylines, odds);

        // assert
        expect(settlementResult).not.toBeNull();
        expect(settlementResult.paylines).toStrictEqual(expectedPaylines);
        expect(settlementResult.jackpotPayline).toBe(1);
    });
});
