import { jackpotValidator } from "../../event-consumers/__tests__/stubs";
import JackpotPrizeGenerator from "../jackpot-prize-generator";

describe("JackpotGenerator", () => {
    let gameData;
    let jackpotSize;
    let generator;

    const player = "player1";

    beforeEach(() => {
        gameData = createStubGameData();
        jackpotSize = 6;
        generator = new JackpotPrizeGenerator({ jackpotSize }, gameData, jackpotValidator);

        jest.spyOn(generator.chance, "pickone");
        jest.spyOn(generator.chance, "shuffle");
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("always validate player can hit jackpot", () => {
        // Arrange
        jest.spyOn(generator.jackpotValidator, "canHitJackpot");

        // Act
        generator.generate(player);

        // Assert
        expect(generator.jackpotValidator.canHitJackpot).toHaveBeenCalledWith(player);
    });

    describe("when player can NOT hit jackpot", () => {
        it("should return empty board", () => {
            // Arrange
            jackpotValidator.canHitJackpot.mockReturnValueOnce(false);

            // Act
            const result = generator.generate(player);

            // Assert
            expect(result).toBeArrayOfSize(0);
        });
    });

    describe("when player can hit jackpot", () => {
        beforeEach(() => {
            jackpotValidator.canHitJackpot.mockReturnValueOnce(true);
        });

        it("should generate a board with the correct size", () => {
            // Arrange
            generator.chance.pickone.mockReturnValueOnce("prizeA").mockReturnValueOnce("prizeB").mockReturnValueOnce("prizeC");
            generator.chance.shuffle.mockImplementation((arr) => arr);

            // Act
            const result = generator.generate(player);

            // Assert
            expect(result).toHaveLength(jackpotSize);
            expect(generator.chance.shuffle).toHaveBeenCalledTimes(3);
        });

        it("should generate a board with valid prizes", () => {
            // Arrange
            const prizes = ["minor", "major", "grand"];
            generator.chance.pickone.mockImplementation(() => prizes[Math.floor(Math.random() * prizes.length)]);
            generator.chance.shuffle.mockImplementation((arr) => arr);

            // Act
            const result = generator.generate();

            // Assert
            result.forEach((prize) => {
                expect(prizes).toContain(prize);
            });
        });

        it("should shuffle the board three times", () => {
            // Arrange
            generator.chance.pickone.mockReturnValue("prizeA");
            generator.chance.shuffle.mockImplementation((arr) => arr.reverse());

            // Act
            generator.generate();

            // Assert
            expect(generator.chance.shuffle).toHaveBeenCalledTimes(3);
        });
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
                    minor: {
                        init: 5000,
                        playerSettings: { contrib: 0.1, alloc: 90 },
                        botSettings: { contrib: 0.01, alloc: 80 },
                    },
                    major: {
                        init: 25000,
                        playerSettings: { contrib: 0.15, alloc: 9 },
                        botSettings: { contrib: 0.015, alloc: 15 },
                    },
                    grand: {
                        init: 50000,
                        playerSettings: { contrib: 0.25, alloc: 1 },
                        botSettings: { contrib: 0.025, alloc: 5 },
                    },
                },
                allowedCurrency: "INH",
            },
        },
    },
});
