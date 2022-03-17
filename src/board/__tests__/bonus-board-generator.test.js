import { BonusBoardGenerator } from "..";

describe("BonusBoardGenerator", () => {
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
        });
    });

    describe("calculateBonusRateRange", () => {
        let boardGenerator;
        beforeEach(() => {
            boardGenerator = new BonusBoardGenerator({ bonusSize: 9 });
        });

        describe("when number of paylines is 1", () => {
            it("should return {min: 1, max: 3}", () => {
                // arrange
                const noPaylines = 1;
                const expectedValue = { min: 1, max: 3 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 2", () => {
            it("should return {min: 1, max: 3}", () => {
                // arrange
                const noPaylines = 2;
                const expectedValue = { min: 1, max: 3 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 3", () => {
            it("should return {min: 1, max: 3}", () => {
                // arrange
                const noPaylines = 3;
                const expectedValue = { min: 1, max: 3 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 4", () => {
            it("should return {min: 1, max: 3}", () => {
                // arrange
                const noPaylines = 4;
                const expectedValue = { min: 1, max: 3 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 5", () => {
            it("should return {min: 1, max: 3.36}", () => {
                // arrange
                const noPaylines = 5;
                const expectedValue = { min: 1, max: 3.36 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 6", () => {
            it("should return {min: 1.28, max: 4.48}", () => {
                // arrange
                const noPaylines = 6;
                const expectedValue = { min: 1.28, max: 4.48 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 7", () => {
            it("should return {min: 1.6, max: 5.6}", () => {
                // arrange
                const noPaylines = 7;
                const expectedValue = { min: 1.6, max: 5.6 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 8", () => {
            it("should return {min: 1.92, max: 6.72}", () => {
                // arrange
                const noPaylines = 8;
                const expectedValue = { min: 1.92, max: 6.72 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 9", () => {
            it("should return {min: 2.24, max: 7.84}", () => {
                // arrange
                const noPaylines = 9;
                const expectedValue = { min: 2.24, max: 7.84 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 10", () => {
            it("should return {min: 2.56, max: 8.96}", () => {
                // arrange
                const noPaylines = 10;
                const expectedValue = { min: 2.56, max: 8.96 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 11", () => {
            it("should return {min: 2.88, max: 10.08}", () => {
                // arrange
                const noPaylines = 11;
                const expectedValue = { min: 2.88, max: 10.08 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 12", () => {
            it("should return {min: 3.2, max: 11.2}", () => {
                // arrange
                const noPaylines = 12;
                const expectedValue = { min: 3.2, max: 11.2 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 13", () => {
            it("should return {min: 3.52, max: 12.32}", () => {
                // arrange
                const noPaylines = 13;
                const expectedValue = { min: 3.52, max: 12.32 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 14", () => {
            it("should return {min: 3.84, max: 13.44}", () => {
                // arrange
                const noPaylines = 14;
                const expectedValue = { min: 3.84, max: 13.44 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 15", () => {
            it("should return {min: 4.16, max: 14.56}", () => {
                // arrange
                const noPaylines = 15;
                const expectedValue = { min: 4.16, max: 14.56 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 16", () => {
            it("should return {min: 4.48, max: 15.68}", () => {
                // arrange
                const noPaylines = 16;
                const expectedValue = { min: 4.48, max: 15.68 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 17", () => {
            it("should return {min: 4.8, max: 16.8}", () => {
                // arrange
                const noPaylines = 17;
                const expectedValue = { min: 4.8, max: 16.8 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 18", () => {
            it("should return {min: 5.12, max: 17.92}", () => {
                // arrange
                const noPaylines = 18;
                const expectedValue = { min: 5.12, max: 17.92 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 19", () => {
            it("should return {min: 5.44, max: 19.04}", () => {
                // arrange
                const noPaylines = 19;
                const expectedValue = { min: 5.44, max: 19.04 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 20", () => {
            it("should return {min: 5.76, max: 20.16}", () => {
                // arrange
                const noPaylines = 20;
                const expectedValue = { min: 5.76, max: 20.16 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 21", () => {
            it("should return {min: 6.08, max: 21.28}", () => {
                // arrange
                const noPaylines = 21;
                const expectedValue = { min: 6.08, max: 21.28 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 22", () => {
            it("should return {min: 6.4, max: 22.4}", () => {
                // arrange
                const noPaylines = 22;
                const expectedValue = { min: 6.4, max: 22.4 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 23", () => {
            it("should return {min: 6.72, max: 23.52}", () => {
                // arrange
                const noPaylines = 23;
                const expectedValue = { min: 6.72, max: 23.52 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 24", () => {
            it("should return {min: 7.04, max: 24.64}", () => {
                // arrange
                const noPaylines = 24;
                const expectedValue = { min: 7.04, max: 24.64 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
        describe("when number of paylines is 25", () => {
            it("should return {min: 7.36, max: 25.76}", () => {
                // arrange
                const noPaylines = 25;
                const expectedValue = { min: 7.36, max: 25.76 };

                // act
                const actualValue = boardGenerator.calculateBonusRateRange(noPaylines);

                // assert
                expect(actualValue).toStrictEqual(expectedValue);
            });
        });
    });
});
