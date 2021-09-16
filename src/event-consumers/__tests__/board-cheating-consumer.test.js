import BoardCheatingConsumer from "../board-cheating-consumer";

describe("board-cheating-consumer", () => {
    describe("consume", () => {
        const testCases = [
            {
                settlementResultFromAdmin: undefined,
                board: [],
                expectedResult: [],
            },
            {
                settlementResultFromAdmin: 0,
                board: [],
                expectedResult: [],
            },
            {
                settlementResultFromAdmin: [1],
                board: [],
                expectedResult: [1],
            },
        ];

        it.each(testCases)("should return correct value", (testCase) => {
            // arrange
            const gameData = { settlementResultFromAdmin: { fourGuardians: testCase.settlementResultFromAdmin } };
            const consumer = new BoardCheatingConsumer(gameData);

            // act
            const actualValue = consumer.consume("fourGuardians", testCase.board);

            // assert
            expect(actualValue).toStrictEqual(testCase.expectedResult);
        });
    });
});
