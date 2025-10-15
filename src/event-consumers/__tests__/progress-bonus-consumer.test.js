import ProgressBonusConsumer from "../progress-bonus-consumer";

describe("ProgressBonusConsumer", () => {
    let progressBonusConsumer;
    let mockDefinition;
    let mockGameData;
    let mockBonusPublisher;
    let mockRoundsRepository;
    let mockProgressBonusRepository;
    let mockLogService;

    beforeEach(() => {
        // Mock dependencies
        mockDefinition = {
            id: 1,
            name: "Test Slot Game",
        };

        mockGameData = {
            ingame: {},
        };

        mockBonusPublisher = {
            publishProgressBonus: jest.fn(),
            publishProgressBonusAward: jest.fn(),
        };

        mockRoundsRepository = {
            findOne: jest.fn(),
            save: jest.fn(),
        };

        mockProgressBonusRepository = {
            findOne: jest.fn().mockReturnValue({
                lean: jest.fn(),
            }),
            findOneAndUpdate: jest.fn(),
            find: jest.fn(),
        };

        mockLogService = {
            logInfo: jest.fn(),
            logError: jest.fn(),
        };

        // Create consumer instance
        progressBonusConsumer = new ProgressBonusConsumer(
            mockDefinition,
            mockGameData,
            mockBonusPublisher,
            mockRoundsRepository,
            mockProgressBonusRepository,
            mockLogService
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
        // Reset the gameData structure
        mockGameData.ingame = {};
    });

    describe("Constructor", () => {
        test("should initialize with default configuration", () => {
            expect(progressBonusConsumer.BETS_TRIGGER_THRESHOLD).toBe(200);
            expect(progressBonusConsumer.BASE_BONUS_PERCENTAGE).toBe(0.01);
            expect(progressBonusConsumer.MIN_BONUS_AMOUNT).toBe(1);
            expect(progressBonusConsumer.MAX_BONUS_AMOUNT).toBe(10000);
            expect(progressBonusConsumer.MULTIPLIERS).toEqual([3, 5, 20, 50, 500]);
            expect(progressBonusConsumer.MULTIPLIER_WEIGHTS).toEqual([0.4, 0.3, 0.2, 0.08, 0.02]);
        });

        test("should initialize with custom configuration", () => {
            const customConfig = {
                betsTriggerThreshold: 100,
                baseBonusPercentage: 0.02,
                minBonusAmount: 5,
                maxBonusAmount: 5000,
                multipliers: [2, 4, 10],
                multiplierWeights: [0.5, 0.3, 0.2],
            };

            const customConsumer = new ProgressBonusConsumer(
                mockDefinition,
                mockGameData,
                mockBonusPublisher,
                mockRoundsRepository,
                mockProgressBonusRepository,
                mockLogService,
                customConfig
            );

            expect(customConsumer.BETS_TRIGGER_THRESHOLD).toBe(100);
            expect(customConsumer.BASE_BONUS_PERCENTAGE).toBe(0.02);
            expect(customConsumer.MIN_BONUS_AMOUNT).toBe(5);
            expect(customConsumer.MAX_BONUS_AMOUNT).toBe(5000);
            expect(customConsumer.MULTIPLIERS).toEqual([2, 4, 10]);
            expect(customConsumer.MULTIPLIER_WEIGHTS).toEqual([0.5, 0.3, 0.2]);
        });

        test("should initialize metrics", () => {
            expect(progressBonusConsumer.metrics).toEqual({
                betsTracked: 0,
                bonusesAwarded: 0,
                totalBonusAmount: 0,
                errors: 0,
            });
        });
    });

    describe("Input Validation", () => {
        test("should validate player object", async () => {
            const invalidPlayer = null;
            const betAmount = 10;
            const roundId = 1;

            await progressBonusConsumer.trackBetAndCheckProgressBonus(invalidPlayer, betAmount, roundId);

            expect(mockLogService.logError).not.toHaveBeenCalled();
        });

        test("should validate bet amount", async () => {
            const player = { profile: { name: "testPlayer" } };
            const invalidBetAmount = -10;
            const roundId = 1;

            await progressBonusConsumer.trackBetAndCheckProgressBonus(player, invalidBetAmount, roundId);

            expect(mockLogService.logError).not.toHaveBeenCalled();
        });

        test("should validate round ID", async () => {
            const player = { profile: { name: "testPlayer" } };
            const betAmount = 10;
            const invalidRoundId = 0;

            await progressBonusConsumer.trackBetAndCheckProgressBonus(player, betAmount, invalidRoundId);

            expect(mockLogService.logError).not.toHaveBeenCalled();
        });
    });

    describe("Bet Tracking", () => {
        test("should track bet count correctly", async () => {
            const player = {
                profile: { name: "testPlayer" },
                UID: "player123",
                session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
            };
            const betAmount = 10;
            const roundId = 1;

            // Set up player data in gameData.ingame
            mockGameData.ingame.testPlayer = {
                player: player,
            };

            mockProgressBonusRepository.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            });
            mockProgressBonusRepository.findOneAndUpdate.mockResolvedValue({});

            await progressBonusConsumer.trackBetAndCheckProgressBonus(player, betAmount, roundId);

            expect(mockGameData.ingame.testPlayer.progressBonus.betCount).toBe(1);
            expect(mockGameData.ingame.testPlayer.progressBonus.totalBetAmount).toBe(10);
        });

        test("should not count free spins in total bet amount", async () => {
            const player = {
                profile: { name: "testPlayer" },
                UID: "player123",
                session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
            };
            const betAmount = 10;
            const roundId = 1;
            const isFreeSpin = true;

            // Set up player data in gameData.ingame
            mockGameData.ingame.testPlayer = {
                player: player,
            };

            mockProgressBonusRepository.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            });
            mockProgressBonusRepository.findOneAndUpdate.mockResolvedValue({});

            await progressBonusConsumer.trackBetAndCheckProgressBonus(player, betAmount, roundId, isFreeSpin);

            expect(mockGameData.ingame.testPlayer.progressBonus.betCount).toBe(1);
            expect(mockGameData.ingame.testPlayer.progressBonus.totalBetAmount).toBe(0);
        });

        test("should load existing progress from database", async () => {
            const player = {
                profile: { name: "testPlayer" },
                UID: "player123",
                session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
            };
            const betAmount = 10;
            const roundId = 1;

            const existingProgress = {
                betCount: 50,
                totalBetAmount: 500,
                lastBonusRoundId: null,
            };

            // Mock the database to return existing progress
            mockProgressBonusRepository.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue(existingProgress),
            });
            mockProgressBonusRepository.findOneAndUpdate.mockResolvedValue({});

            // Set up player data in gameData.ingame but WITHOUT progressBonus property
            // so that initializePlayerProgress will call loadProgressFromDatabase
            mockGameData.ingame.testPlayer = {
                player: player,
                // Note: no progressBonus property - this will trigger database load
            };

            await progressBonusConsumer.trackBetAndCheckProgressBonus(player, betAmount, roundId);

            // Verify that the database was called to load progress
            expect(mockProgressBonusRepository.findOne).toHaveBeenCalledWith({
                playerId: "p123",
                operatorId: "op123",
            });

            // The progress should be loaded from database and then incremented
            // betCount starts at 0 in memory, then gets incremented to 1
            expect(mockGameData.ingame.testPlayer.progressBonus.betCount).toBe(1);
            expect(mockGameData.ingame.testPlayer.progressBonus.totalBetAmount).toBe(510);
        });

        test("should load progress from database directly", async () => {
            const player = {
                profile: { name: "testPlayer" },
                UID: "player123",
                session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
            };

            const existingProgress = {
                betCount: 50,
                totalBetAmount: 500,
                lastBonusRoundId: null,
            };

            // Set up player data in gameData.ingame
            mockGameData.ingame.testPlayer = {
                player: player,
            };

            // Mock the database to return existing progress
            mockProgressBonusRepository.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue(existingProgress),
            });

            // Call loadProgressFromDatabase directly
            const result = await progressBonusConsumer.loadProgressFromDatabase("testPlayer");

            // Verify that the database was called
            expect(mockProgressBonusRepository.findOne).toHaveBeenCalledWith({
                playerId: "p123",
                operatorId: "op123",
            });

            // Verify the result - betCount is now memory-only, so it starts at 0
            expect(result).toEqual({
                betCount: 0, // Always starts at 0 in memory
                totalBetAmount: 500,
                lastBonusRoundId: null,
                lastTapTime: undefined,
                isDecreasing: false,
                decreaseStartTime: undefined,
            });
        });
    });

    describe("Bonus Trigger", () => {
        test("should trigger bonus at threshold", async () => {
            const player = {
                profile: { name: "testPlayer" },
                UID: "player123",
                session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
            };
            const betAmount = 10;
            const roundId = 1;

            // Set up existing progress at 199 bets (but betCount is memory-only)
            const existingProgress = {
                totalBetAmount: 1990,
                lastBonusRoundId: null,
            };

            // Mock the database to return existing progress
            mockProgressBonusRepository.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue(existingProgress),
            });
            mockProgressBonusRepository.findOneAndUpdate.mockResolvedValue({});

            // Set up player data in gameData.ingame but WITHOUT progressBonus property
            // so that initializePlayerProgress will call loadProgressFromDatabase
            mockGameData.ingame.testPlayer = {
                player: player,
                // Note: no progressBonus property - this will trigger database load
            };

            // Mock the initializePlayerProgress to set betCount to 199 after loading from database
            const originalMethod = progressBonusConsumer.initializePlayerProgress;
            progressBonusConsumer.initializePlayerProgress = async function (playerName) {
                await originalMethod.call(this, playerName);
                if (playerName === "testPlayer") {
                    this.gameData.ingame[playerName].progressBonus.betCount = 199;
                }
            };

            const triggerSpy = jest.spyOn(progressBonusConsumer, "triggerProgressBonus");
            const resetSpy = jest.spyOn(progressBonusConsumer, "resetProgress");

            await progressBonusConsumer.trackBetAndCheckProgressBonus(player, betAmount, roundId);

            expect(triggerSpy).toHaveBeenCalledWith(player, 2000, roundId);
            expect(resetSpy).toHaveBeenCalledWith("testPlayer", roundId);
        });

        test("should not trigger bonus below threshold", async () => {
            const player = {
                profile: { name: "testPlayer" },
                UID: "player123",
                session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
            };
            const betAmount = 10;
            const roundId = 1;

            // Set up player data in gameData.ingame
            mockGameData.ingame.testPlayer = {
                player: player,
            };

            // Set up existing progress at 50 bets
            const existingProgress = {
                betCount: 50,
                totalBetAmount: 500,
                lastBonusRoundId: null,
            };

            mockProgressBonusRepository.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue(existingProgress),
            });
            mockProgressBonusRepository.findOneAndUpdate.mockResolvedValue({});

            const triggerSpy = jest.spyOn(progressBonusConsumer, "triggerProgressBonus");

            await progressBonusConsumer.trackBetAndCheckProgressBonus(player, betAmount, roundId);

            expect(triggerSpy).not.toHaveBeenCalled();
        });
    });

    describe("Bonus Calculation", () => {
        test("should calculate bonus amount correctly", () => {
            const totalBetAmount = 1000;
            const bonusCalculation = progressBonusConsumer.calculateBonusAmount(totalBetAmount);

            expect(bonusCalculation.baseAmount).toBe(10); // 1% of 1000
            expect(bonusCalculation.multiplier).toBeOneOf([3, 5, 20, 50, 500]);
            expect(bonusCalculation.finalAmount).toBe(bonusCalculation.baseAmount * bonusCalculation.multiplier);
        });

        test("should apply minimum bonus amount", () => {
            const totalBetAmount = 10; // Very small amount
            const bonusCalculation = progressBonusConsumer.calculateBonusAmount(totalBetAmount);

            expect(bonusCalculation.finalAmount).toBeGreaterThanOrEqual(1);
        });

        test("should apply maximum bonus amount", () => {
            const totalBetAmount = 1000000; // Very large amount
            const bonusCalculation = progressBonusConsumer.calculateBonusAmount(totalBetAmount);

            expect(bonusCalculation.finalAmount).toBeLessThanOrEqual(10000);
        });
    });

    describe("Progress Status", () => {
        test("should return default status for new player", () => {
            const player = { profile: { name: "newPlayer" } };
            const status = progressBonusConsumer.getProgressBonusStatus(player);

            expect(status).toEqual({
                betCount: 0,
                totalBetAmount: 0,
                remainingBets: 200,
                progressPercentage: 0,
                lastTapTime: null,
                isDecreasing: false,
                decreaseStartTime: null,
            });
        });

        test("should return correct status for existing player", () => {
            const player = { profile: { name: "testPlayer" } };

            // Set up existing progress
            mockGameData.ingame.testPlayer = {
                progressBonus: {
                    betCount: 50,
                    totalBetAmount: 500,
                    lastBonusRoundId: null,
                    lastTapTime: new Date(),
                    isDecreasing: false,
                    decreaseStartTime: null,
                },
            };

            const status = progressBonusConsumer.getProgressBonusStatus(player);

            expect(status.betCount).toBe(50);
            expect(status.totalBetAmount).toBe(500);
            expect(status.remainingBets).toBe(150);
            expect(status.progressPercentage).toBe(25);
        });
    });

    describe("Database Operations", () => {
        test("should save progress to database with retry", async () => {
            const playerName = "testPlayer";
            const progressData = {
                betCount: 1,
                totalBetAmount: 10,
                lastBonusRoundId: null,
            };

            // Mock player data
            mockGameData.ingame.testPlayer = {
                player: {
                    session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
                    UID: "player123",
                },
            };

            mockProgressBonusRepository.findOneAndUpdate.mockResolvedValue({});

            await progressBonusConsumer.saveProgressToDatabaseWithRetry(playerName, progressData);

            expect(mockProgressBonusRepository.findOneAndUpdate).toHaveBeenCalledWith(
                { playerId: "p123", operatorId: "op123" },
                {
                    $set: expect.objectContaining({
                        totalBetAmount: 10,
                        lastBonusRoundId: null,
                        // betCount is no longer saved to database
                    }),
                },
                { upsert: true, new: true }
            );
        });

        test("should retry database operations on failure", async () => {
            const playerName = "testPlayer";
            const progressData = {
                betCount: 1,
                totalBetAmount: 10,
                lastBonusRoundId: null,
            };

            // Mock player data
            mockGameData.ingame.testPlayer = {
                player: {
                    session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
                    UID: "player123",
                },
            };

            // First call fails, second succeeds
            mockProgressBonusRepository.findOneAndUpdate.mockRejectedValueOnce(new Error("Database error")).mockResolvedValueOnce({});

            await progressBonusConsumer.saveProgressToDatabaseWithRetry(playerName, progressData);

            expect(mockProgressBonusRepository.findOneAndUpdate).toHaveBeenCalledTimes(2);
        });

        test("should throw error after max retries", async () => {
            const playerName = "testPlayer";
            const progressData = {
                betCount: 1,
                totalBetAmount: 10,
                lastBonusRoundId: null,
            };

            // Mock player data
            mockGameData.ingame.testPlayer = {
                player: {
                    session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
                    UID: "player123",
                },
            };

            // All calls fail
            mockProgressBonusRepository.findOneAndUpdate.mockRejectedValue(new Error("Database error"));

            await expect(progressBonusConsumer.saveProgressToDatabaseWithRetry(playerName, progressData)).rejects.toThrow("Database error");

            expect(mockProgressBonusRepository.findOneAndUpdate).toHaveBeenCalledTimes(3);
        });
    });

    describe("Metrics", () => {
        test("should track metrics correctly", async () => {
            const player = {
                profile: { name: "testPlayer" },
                UID: "player123",
                session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
            };
            const betAmount = 10;
            const roundId = 1;

            // Set up player data in gameData.ingame
            mockGameData.ingame.testPlayer = {
                player: player,
            };

            mockProgressBonusRepository.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue(null),
            });
            mockProgressBonusRepository.findOneAndUpdate.mockResolvedValue({});

            await progressBonusConsumer.trackBetAndCheckProgressBonus(player, betAmount, roundId);

            expect(progressBonusConsumer.metrics.betsTracked).toBe(1);
        });

        test("should reset metrics", () => {
            progressBonusConsumer.metrics.betsTracked = 10;
            progressBonusConsumer.metrics.bonusesAwarded = 5;
            progressBonusConsumer.metrics.totalBonusAmount = 1000;
            progressBonusConsumer.metrics.errors = 2;

            progressBonusConsumer.resetMetrics();

            expect(progressBonusConsumer.metrics).toEqual({
                betsTracked: 0,
                bonusesAwarded: 0,
                totalBonusAmount: 0,
                errors: 0,
            });
        });

        test("should calculate average bonus amount", () => {
            progressBonusConsumer.metrics.bonusesAwarded = 4;
            progressBonusConsumer.metrics.totalBonusAmount = 1000;

            const metrics = progressBonusConsumer.getMetrics();

            expect(metrics.averageBonusAmount).toBe(250);
        });
    });

    describe("Error Handling", () => {
        test("should handle database errors gracefully", async () => {
            const player = {
                profile: { name: "testPlayer" },
                UID: "player123",
                session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
            };
            const betAmount = 10;
            const roundId = 1;

            // Set up player data in gameData.ingame
            mockGameData.ingame.testPlayer = {
                player: player,
            };

            mockProgressBonusRepository.findOne.mockReturnValue({
                lean: jest.fn().mockRejectedValue(new Error("Database connection failed")),
            });
            mockProgressBonusRepository.findOneAndUpdate.mockRejectedValue(new Error("Database connection failed"));

            await expect(progressBonusConsumer.trackBetAndCheckProgressBonus(player, betAmount, roundId)).rejects.toThrow(
                "Database connection failed"
            );

            // The error count will be higher due to retry attempts, so we check it's at least 1
            expect(progressBonusConsumer.metrics.errors).toBeGreaterThanOrEqual(1);
        });

        test("should log errors with context", async () => {
            const player = {
                profile: { name: "testPlayer" },
                UID: "player123",
                session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
            };
            const betAmount = 10;
            const roundId = 1;

            mockProgressBonusRepository.findOne.mockRejectedValue(new Error("Database error"));

            await expect(progressBonusConsumer.trackBetAndCheckProgressBonus(player, betAmount, roundId)).rejects.toThrow();

            expect(mockLogService.logError).toHaveBeenCalledWith(
                expect.stringContaining("Error in trackBetAndCheckProgressBonus"),
                expect.objectContaining({
                    playerName: "testPlayer",
                    betAmount: 10,
                    roundId: 1,
                    isFreeSpin: false,
                })
            );
        });
    });

    describe("Reset Functionality", () => {
        test("should reset progress for player", async () => {
            const player = {
                profile: { name: "testPlayer" },
                UID: "player123",
                session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
            };

            // Set up existing progress
            mockGameData.ingame.testPlayer = {
                progressBonus: {
                    betCount: 50,
                    totalBetAmount: 500,
                    lastBonusRoundId: 123,
                },
                player: {
                    session: { playerId: "p123", operatorId: "op123", currencyName: "USD" },
                    UID: "player123",
                },
            };

            mockProgressBonusRepository.findOneAndUpdate.mockResolvedValue({});

            await progressBonusConsumer.resetProgressBonus(player);

            expect(mockGameData.ingame.testPlayer.progressBonus.betCount).toBe(0);
            expect(mockGameData.ingame.testPlayer.progressBonus.totalBetAmount).toBe(0);
            expect(mockGameData.ingame.testPlayer.progressBonus.lastBonusRoundId).toBe(null);
        });
    });

    describe("Countdown Functionality", () => {
        beforeEach(() => {
            // Setup player in game data
            mockGameData.ingame.testPlayer = {
                player: {
                    profile: { name: "testPlayer" },
                    session: { playerId: "p1", operatorId: "op1", currencyName: "USD" },
                    UID: "uid1",
                },
            };
        });

        test("should start countdown when player is inactive for 3+ seconds", async () => {
            const now = new Date();
            const inactiveTime = new Date(now.getTime() - 4000); // 4 seconds ago

            // Setup existing progress with inactive time
            mockGameData.ingame.testPlayer.progressBonus = {
                betCount: 50,
                totalBetAmount: 500,
                lastTapTime: inactiveTime,
                isDecreasing: false,
                decreaseStartTime: null,
            };

            mockProgressBonusRepository.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    totalBetAmount: 500,
                    lastBonusRoundId: null,
                    lastTapTime: inactiveTime,
                    isDecreasing: false,
                    decreaseStartTime: null,
                }),
            });

            await progressBonusConsumer.trackBetAndCheckProgressBonus(mockGameData.ingame.testPlayer.player, 10, 1);

            // Should have calculated countdown and published start event
            expect(mockGameData.ingame.testPlayer.progressBonus.isDecreasing).toBe(true);
            expect(mockGameData.ingame.testPlayer.progressBonus.decreaseStartTime).toBeDefined();
            expect(mockBonusPublisher.publishProgressBonus).toHaveBeenCalledWith(
                "uid1",
                expect.objectContaining({
                    type: "progress_bonus_countdown_start",
                    message: "Tap Tap!",
                })
            );
        });

        test("should calculate correct betCount after countdown", async () => {
            const now = new Date();
            const inactiveTime = new Date(now.getTime() - 5000); // 5 seconds ago (2 seconds of countdown)

            // Setup existing progress
            mockGameData.ingame.testPlayer.progressBonus = {
                betCount: 50,
                totalBetAmount: 500,
                lastTapTime: inactiveTime,
                isDecreasing: false,
                decreaseStartTime: null,
            };

            mockProgressBonusRepository.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    totalBetAmount: 500,
                    lastBonusRoundId: null,
                    lastTapTime: inactiveTime,
                    isDecreasing: false,
                    decreaseStartTime: null,
                }),
            });

            await progressBonusConsumer.trackBetAndCheckProgressBonus(mockGameData.ingame.testPlayer.player, 10, 1);

            // Should have decreased betCount by ~13 (2000ms / 150ms intervals)
            expect(mockGameData.ingame.testPlayer.progressBonus.betCount).toBeLessThan(50);
            expect(mockGameData.ingame.testPlayer.progressBonus.betCount).toBeGreaterThan(35);
        });

        test("should stop countdown when player becomes active", async () => {
            const now = new Date();
            const recentTime = new Date(now.getTime() - 1000); // 1 second ago (active)

            // Setup existing progress that was decreasing
            mockGameData.ingame.testPlayer.progressBonus = {
                betCount: 30,
                totalBetAmount: 500,
                lastTapTime: recentTime,
                isDecreasing: true,
                decreaseStartTime: new Date(now.getTime() - 2000),
            };

            mockProgressBonusRepository.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    totalBetAmount: 500,
                    lastBonusRoundId: null,
                    lastTapTime: recentTime,
                    isDecreasing: true,
                    decreaseStartTime: new Date(now.getTime() - 2000),
                }),
            });

            await progressBonusConsumer.trackBetAndCheckProgressBonus(mockGameData.ingame.testPlayer.player, 10, 1);

            // Should have stopped countdown
            expect(mockGameData.ingame.testPlayer.progressBonus.isDecreasing).toBe(false);
            expect(mockGameData.ingame.testPlayer.progressBonus.decreaseStartTime).toBeNull();
            expect(mockBonusPublisher.publishProgressBonus).toHaveBeenCalledWith(
                "uid1",
                expect.objectContaining({
                    type: "progress_bonus_countdown_stop",
                })
            );
        });

        test("should publish countdown end when betCount reaches zero", async () => {
            const now = new Date();
            const inactiveTime = new Date(now.getTime() - 10000); // 10 seconds ago (7 seconds of countdown)

            // Setup existing progress with low betCount
            mockGameData.ingame.testPlayer.progressBonus = {
                betCount: 5,
                totalBetAmount: 500,
                lastTapTime: inactiveTime,
                isDecreasing: false,
                decreaseStartTime: null,
            };

            mockProgressBonusRepository.findOne.mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    totalBetAmount: 500,
                    lastBonusRoundId: null,
                    lastTapTime: inactiveTime,
                    isDecreasing: false,
                    decreaseStartTime: null,
                }),
            });

            await progressBonusConsumer.trackBetAndCheckProgressBonus(mockGameData.ingame.testPlayer.player, 10, 1);

            // Should have reached zero during countdown, then added new bet (so betCount = 1)
            expect(mockGameData.ingame.testPlayer.progressBonus.betCount).toBe(1);
            expect(mockGameData.ingame.testPlayer.progressBonus.isDecreasing).toBe(false);
            expect(mockBonusPublisher.publishProgressBonus).toHaveBeenCalledWith(
                "uid1",
                expect.objectContaining({
                    type: "progress_bonus_countdown_end",
                    reason: "progress_reached_zero",
                })
            );
        });
    });
});
