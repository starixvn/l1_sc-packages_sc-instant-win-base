import { BonusBoardGenerator } from "..";

describe("BonusBoardGenerator", () => {
    const boardPaylines = Array(25);
    const bonusSize = 10;
    const amount = 1;
    const minRate = 8;
    const maxRate = 28;
    const numberOfPaylines = 1;

    describe("generate", () => {
        it("should generate approriate board base on definition", () => {
            // arrange
            const boardGenerator = new BonusBoardGenerator({ bonusSize });

            // act
            const board = boardGenerator.generate(amount, minRate, maxRate, numberOfPaylines);

            // assert
            expect(board.length).toEqual(bonusSize);
        });

        it("should round amounts to 4 decimal places", () => {
            // arrange
            const boardGenerator = new BonusBoardGenerator({ bonusSize });
            const betAmount = 1.23456789;

            // act
            const board = boardGenerator.generate(betAmount, minRate, maxRate, numberOfPaylines);

            // assert
            board.forEach((bonus) => {
                // Verify the amount is properly rounded by checking it equals itself when rounded
                const roundedAmount = Math.round(bonus.amount * 10000) / 10000;
                expect(bonus.amount).toBe(roundedAmount);
            });
        });

        describe("when apply new bonus calculator", () => {
            const boardGenerator = new BonusBoardGenerator({ bonusSize, applyNewBonusCalculation: true }, { paylines: boardPaylines });

            beforeEach(() => {
                boardGenerator.calculateBonusRateRange = jest.fn();
            });

            it("should call calculateBonusRateRange", () => {
                // arrange

                // act
                boardGenerator.generate(amount, minRate, maxRate, numberOfPaylines);

                // assert
                expect(boardGenerator.calculateBonusRateRange).toHaveBeenCalledWith(minRate, maxRate, numberOfPaylines);
            });
        });

        describe("when NOT apply new bonus calculator", () => {
            const boardGenerator = new BonusBoardGenerator({ bonusSize }, { paylines: boardPaylines });

            beforeEach(() => {
                boardGenerator.calculateBonusRateRange = jest.fn();
            });

            it("should NOT call calculateBonusRateRange", () => {
                // arrange

                // act
                boardGenerator.generate(amount, minRate, maxRate, numberOfPaylines);

                // assert
                expect(boardGenerator.calculateBonusRateRange).not.toHaveBeenCalled();
            });
        });
    });

    describe("calculateBonusRateRange", () => {
        const minRate = 8;
        const maxRate = 28;

        let boardGenerator;
        beforeEach(() => {
            boardGenerator = new BonusBoardGenerator({ bonusSize: 9 }, { paylines: boardPaylines });
        });

        describe("when number of paylines is 1", () => {
            it("should return {min: 1, max: 3}", () => {
                // arrange
                const numberOfPaylines = 1;
                const expectedValue = { min: 1, max: 3 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 2", () => {
            it("should return {min: 1, max: 3}", () => {
                // arrange
                const numberOfPaylines = 2;
                const expectedValue = { min: 1, max: 3 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 3", () => {
            it("should return {min: 1, max: 3}", () => {
                // arrange
                const numberOfPaylines = 3;
                const expectedValue = { min: 1, max: 3 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 4", () => {
            it("should return {min: 1, max: 3}", () => {
                // arrange
                const numberOfPaylines = 4;
                const expectedValue = { min: 1, max: 3 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 5", () => {
            it("should return {min: 1, max: 3}", () => {
                // arrange
                const numberOfPaylines = 5;
                const expectedValue = { min: 1, max: 3 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 6", () => {
            it("should return {min: 1, max: 4}", () => {
                // arrange
                const numberOfPaylines = 6;
                const expectedValue = { min: 1, max: 4 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 7", () => {
            it("should return {min: 1, max: 5}", () => {
                // arrange
                const numberOfPaylines = 7;
                const expectedValue = { min: 1, max: 5 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 8", () => {
            it("should return {min: 1, max: 6}", () => {
                // arrange
                const numberOfPaylines = 8;
                const expectedValue = { min: 1, max: 6 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 9", () => {
            it("should return {min: 2, max: 7}", () => {
                // arrange
                const numberOfPaylines = 9;
                const expectedValue = { min: 2, max: 7 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 10", () => {
            it("should return {min: 2, max: 8}", () => {
                // arrange
                const numberOfPaylines = 10;
                const expectedValue = { min: 2, max: 8 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 11", () => {
            it("should return {min: 2, max: 10}", () => {
                // arrange
                const numberOfPaylines = 11;
                const expectedValue = { min: 2, max: 10 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 12", () => {
            it("should return {min: 3, max: 11}", () => {
                // arrange
                const numberOfPaylines = 12;
                const expectedValue = { min: 3, max: 11 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 13", () => {
            it("should return {min: 3, max: 12}", () => {
                // arrange
                const numberOfPaylines = 13;
                const expectedValue = { min: 3, max: 12 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 14", () => {
            it("should return {min: 3, max: 13}", () => {
                // arrange
                const numberOfPaylines = 14;
                const expectedValue = { min: 3, max: 13 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 15", () => {
            it("should return {min: 4, max: 14}", () => {
                // arrange
                const numberOfPaylines = 15;
                const expectedValue = { min: 4, max: 14 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 16", () => {
            it("should return {min: 4, max: 15}", () => {
                // arrange
                const numberOfPaylines = 16;
                const expectedValue = { min: 4, max: 15 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 17", () => {
            it("should return {min: 4, max: 16}", () => {
                // arrange
                const numberOfPaylines = 17;
                const expectedValue = { min: 4, max: 16 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 18", () => {
            it("should return {min: 5, max: 17}", () => {
                // arrange
                const numberOfPaylines = 18;
                const expectedValue = { min: 5, max: 17 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 19", () => {
            it("should return {min: 5, max: 19}", () => {
                // arrange
                const numberOfPaylines = 19;
                const expectedValue = { min: 5, max: 19 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 20", () => {
            it("should return {min: 5, max: 20}", () => {
                // arrange
                const numberOfPaylines = 20;
                const expectedValue = { min: 5, max: 20 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 21", () => {
            it("should return {min: 6, max: 21}", () => {
                // arrange
                const numberOfPaylines = 21;
                const expectedValue = { min: 6, max: 21 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 22", () => {
            it("should return {min: 6, max: 22}", () => {
                // arrange
                const numberOfPaylines = 22;
                const expectedValue = { min: 6, max: 22 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 23", () => {
            it("should return {min: 6, max: 23}", () => {
                // arrange
                const numberOfPaylines = 23;
                const expectedValue = { min: 6, max: 23 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 24", () => {
            it("should return {min: 7, max: 24}", () => {
                // arrange
                const numberOfPaylines = 24;
                const expectedValue = { min: 7, max: 24 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 25", () => {
            it("should return {min: 7, max: 25}", () => {
                // arrange
                const numberOfPaylines = 25;
                const expectedValue = { min: 7, max: 25 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(minRate, maxRate, numberOfPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
    });
});
