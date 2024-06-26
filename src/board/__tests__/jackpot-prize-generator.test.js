import JackpotPrizeGenerator from "../jackpot-prize-generator";

describe("JackpotGenerator", () => {
    let gameData;
    let jackpotSize;
    let generator;

    beforeEach(() => {
        gameData = createStubGameData();
        jackpotSize = 6;
        generator = new JackpotPrizeGenerator({ jackpotSize }, gameData);

        jest.spyOn(generator.chance, "pickone");
        jest.spyOn(generator.chance, "shuffle");
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("should generate a board with the correct size", () => {
        // Arrange
        generator.chance.pickone.mockReturnValueOnce("prizeA").mockReturnValueOnce("prizeB").mockReturnValueOnce("prizeC");
        generator.chance.shuffle.mockImplementation((arr) => arr);

        // Act
        const result = generator.generate();

        // Assert
        expect(result).toHaveLength(jackpotSize);
        expect(generator.chance.pickone).toHaveBeenCalledTimes(jackpotSize);
        expect(generator.chance.shuffle).toHaveBeenCalledTimes(3);
    });

    test("should generate a board with valid prizes", () => {
        // Arrange
        const prizes = ["minor", "major", "grand"];
        generator.chance.pickone.mockImplementation(() => prizes[Math.floor(Math.random() * prizes.length)]);
        generator.chance.shuffle.mockImplementation((arr) => arr);

        // Act
        const result = generator.generate();

        // Assert
        result.forEach((jackpot) => {
            expect(prizes).toContain(jackpot.prize);
        });
    });

    test("should shuffle the board three times", () => {
        // Arrange
        generator.chance.pickone.mockReturnValue("prizeA");
        generator.chance.shuffle.mockImplementation((arr) => arr.reverse());

        // Act
        generator.generate();

        // Assert
        expect(generator.chance.shuffle).toHaveBeenCalledTimes(3);
    });
});

const createStubGameData = () => ({
    gameConfigs: {
        slotsConfig: {
            betLevels: [0.1, 1, 5],
            jackpot: {
                enabled: true,
                excludeTestCurrency: false,
                winningRatio: 0.98,
                pools: {
                    minor: { init: 5000, contribute: 0.1, bot: 0.01 },
                    major: { init: 25000, contribute: 0.15, bot: 0.015 },
                    grand: { init: 50000, contribute: 0.25, bot: 0.025 },
                },
                allowedCurrency: "INH",
            },
        },
    },
});
