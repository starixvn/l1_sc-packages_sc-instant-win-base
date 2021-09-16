import { BonusBoardGenerator } from "..";

describe("generate", () => {
    it("should generate approriate board base on definition", () => {
        // arrange
        const bonusSize = 10;
        const boardGenerator = new BonusBoardGenerator({ bonusSize });
        const amount = 1;
        const minRate = 8;
        const maxRate = 28;

        // act
        const board = boardGenerator.generate(amount, minRate, maxRate);

        // assert
        expect(board.length).toEqual(bonusSize);
        expect(board.every((chest) => chest.amount >= amount * minRate)).toBeTrue();
        expect(board.every((chest) => chest.amount <= amount * maxRate)).toBeTrue();
    });
});
