import math from "lodash/math";
import { Core } from "sc-game-base";
import JackpotValidator from "../../validators/jackpot-validator";
import SlotProcessBetQueue from "../slot-process-bet-queue";

// Helper function to create all required mock dependencies for sc-game-base 6.1.0
const createMockDependencies = () => ({
    gameManagementApiClientFactory: {
        instance: jest.fn().mockReturnValue({
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
        }),
    },
    baseMetrics: {
        increment: jest.fn(),
        decrement: jest.fn(),
        set: jest.fn(),
        get: jest.fn(),
        collectBetProcessedTime: jest.fn(),
    },
});

describe("slot-process-bet-queue", () => {
    describe("extends", () => {
        it("should extend Core.Crons.BaseBot", () => {
            // act
            const mockDeps = createMockDependencies();
            const cron = new SlotProcessBetQueue({ ...mockDeps });

            // assert
            expect(cron instanceof Core.Crons.ProcessBetQueue);
        });
    });

    describe("generatePlacingBetResult", () => {
        it("should return correct value", () => {
            // arrange
            const mockDeps = createMockDependencies();
            const cron = new SlotProcessBetQueue({ ...mockDeps });
            const player = {};
            const balance = { username: "username" };
            const bet = { totalAmount: 10, freeSpin: 1 };
            const expectedValue = { endBet: 10, freeSpin: 1, user: { username: "username" } };

            // act
            const actualValue = cron.generatePlacingBetResult(player, balance, bet);

            // assert
            expect(actualValue).toStrictEqual(expectedValue);
        });
    });

    describe("upsertBet", () => {
        it("when have player session should create correct info", async () => {
            // arrange
            const roundsRepository = { create: jest.fn() };
            const gameData = { exchangeRates: {}, gameConfigs: { slotsConfig: { jackpot: { enabled: false } } } };
            const jackpotValidator = new JackpotValidator(gameData);
            const mockDeps = createMockDependencies();
            const cron = new SlotProcessBetQueue({ roundsRepository, gameData, jackpotValidator, ...mockDeps });
            const player = { session: { playerId: 1, siteId: 2 }, profile: { name: "user3" } };
            const bet = { totalAmount: 10, freeSpin: 1 };

            // act
            await cron.upsertBet(player, 1, bet, 1);

            // assert
            expect(roundsRepository.create).toHaveBeenCalledWith(expect.objectContaining({ playerId: 1, siteId: 2 }));
        });

        it("when not have player session should create correct info", async () => {
            // arrange
            const roundsRepository = { create: jest.fn() };
            const gameData = { exchangeRates: {}, gameConfigs: { slotsConfig: { jackpot: { enabled: false } } } };
            const jackpotValidator = new JackpotValidator(gameData);
            const mockDeps = createMockDependencies();
            const cron = new SlotProcessBetQueue({ roundsRepository, gameData, jackpotValidator, ...mockDeps });
            const player = { profile: { name: "user3" }, session: null };
            const bet = { totalAmount: 10, freeSpin: 1 };

            // act
            await cron.upsertBet(player, 1, bet);

            // assert
            expect(roundsRepository.create).toHaveBeenCalledWith(expect.objectContaining({ name: "user3" }));
        });

        describe("when jackpot is enabled", () => {
            it("Should calculate contribution amount", async () => {
                // arrange
                const roundsRepository = { create: jest.fn() };
                const gameData = { exchangeRates: {}, gameConfigs: { slotsConfig: { jackpot: { enabled: true } } } };
                const jackpotValidator = new JackpotValidator(gameData);
                const mockDeps = createMockDependencies();
                const cron = new SlotProcessBetQueue({ roundsRepository, gameData, jackpotValidator, ...mockDeps });
                const player = { session: { playerId: 1, siteId: 2 }, profile: { name: "user3" } };
                const bet = { totalAmount: 10, freeSpin: 1, contributionRate: 0.025 };
                const rate = 0.8;
                // act
                await cron.upsertBet(player, 1, bet, rate);

                // assert
                expect(roundsRepository.create).toHaveBeenCalledWith(
                    expect.objectContaining({
                        playerId: 1,
                        siteId: 2,
                        jackpotContribution: {
                            contributionRate: bet.contributionRate,
                            baseContributionAmount: bet.totalAmount * bet.contributionRate * rate,
                        },
                    })
                );
            });
        });
    });

    describe("handleSuccessBet", () => {
        it("should call settleGameRoundConsumer.settleRound", async () => {
            // arrange
            const settleGameRoundConsumer = { settleRound: jest.fn() };
            const progressBonusConsumer = { trackBetAndCheckProgressBonus: jest.fn() };
            const gameData = { exchangeRates: { code: [] } };
            const mockDeps = createMockDependencies();
            const cron = new SlotProcessBetQueue({ settleGameRoundConsumer, progressBonusConsumer, gameData, ...mockDeps });
            cron.upsertBet = jest.fn();
            cron.notifyPlacingBetResult = jest.fn();

            const player = { session: {} };
            const balance = { username: "username" };
            const bet = { totalAmount: 10, freeSpin: false };

            // act
            await cron.handleSuccessBet(player, balance, 1, bet);

            // assert
            expect(settleGameRoundConsumer.settleRound).toBeCalled();
        });

        it("when is freespin should call freeSpinsConsumer.useFreeSpin", async () => {
            // arrange
            const settleGameRoundConsumer = { settleRound: jest.fn() };
            const progressBonusConsumer = { trackBetAndCheckProgressBonus: jest.fn() };
            const freeSpinsConsumer = { useFreeSpin: jest.fn() };
            const gameData = { exchangeRates: { code: [] } };
            const mockDeps = createMockDependencies();
            const cron = new SlotProcessBetQueue({ settleGameRoundConsumer, progressBonusConsumer, freeSpinsConsumer, gameData, ...mockDeps });
            cron.upsertBet = jest.fn();
            cron.notifyPlacingBetResult = jest.fn();

            const player = { session: {} };
            const balance = { username: "username" };
            const bet = { totalAmount: 10, freeSpin: true };

            // act
            await cron.handleSuccessBet(player, balance, 1, bet);

            // assert
            expect(freeSpinsConsumer.useFreeSpin).toBeCalled();
        });
    });

    describe("composeBettingTimeValidationCriteria", () => {
        it("should return empty", () => {
            // arrange
            const mockDeps = createMockDependencies();
            const cron = new SlotProcessBetQueue({ ...mockDeps });

            // act
            const actualValue = cron.composeBettingTimeValidationCriteria(1);

            // assert
            expect(actualValue).toStrictEqual([]);
        });
    });

    describe("formatApiBetInfo", () => {
        it("should return correct value", () => {
            // arrange
            const definition = { id: 1 };
            const gameData = { roundId: 2 };

            const mockDeps = createMockDependencies();
            const cron = new SlotProcessBetQueue({ definition, gameData, ...mockDeps });
            const payload = {
                totalAmount: 10,
                freeBet: false,
                freeSpin: false,
                contributionRate: 1,
                contributionAmount: 2,
            };

            const expectedValue = {
                amount: 10,
                gameId: 1,
                gameRoundId: 2,
                choiceId: 0,
                freeBet: false,
                freeSpin: false,
                contributionRate: 1,
                contributionAmount: 2,
            };

            // act
            const actualValue = cron.formatApiBetInfo(payload);

            // assert
            expect(actualValue).toStrictEqual(expectedValue);
        });
    });

    describe("proceedBet", () => {
        it("when bet already finished should publishGameFailedBet", async () => {
            // arrange
            const gameData = {
                ingame: {
                    player1: { finish: true },
                },
            };
            const placeBetPublisher = { publishGameFailedBet: jest.fn() };
            const mockDeps = createMockDependencies();
            const cron = new SlotProcessBetQueue({ gameData, placeBetPublisher, ...mockDeps });
            const player = { profile: { name: "player1" } };
            const payload = {};

            // act
            await cron.proceedBet(player, payload);

            // assert
            expect(placeBetPublisher.publishGameFailedBet).toBeCalled();
        });

        it("when freeSpin but not have soonestExpiredFreeSpinSet should publishGameFailedBet", async () => {
            // arrange
            const gameData = {
                ingame: {
                    player1: { finish: false },
                },
                gameConfigs: {
                    slotsConfig: { jackpot: {} },
                },
            };
            const placeBetPublisher = { publishGameFailedBet: jest.fn() };
            const freeSpinsConsumer = { getSoonestExpiredFreeSpinSet: jest.fn() };
            const soonestExpiredFreeSpinSet = null;
            freeSpinsConsumer.getSoonestExpiredFreeSpinSet.mockReturnValueOnce(soonestExpiredFreeSpinSet);
            const mockDeps = createMockDependencies();
            const cron = new SlotProcessBetQueue({ gameData, placeBetPublisher, freeSpinsConsumer, ...mockDeps });
            const player = { profile: { name: "player1" } };
            const payload = { freeSpin: true };

            // act
            await cron.proceedBet(player, payload);

            // assert
            expect(placeBetPublisher.publishGameFailedBet).toBeCalled();
        });

        const testCases = [
            { jackpot: { enabled: true, playerContributionRatio: 5 }, soonestExpiredFreeSpinSet: { bet: 1, paylines: [] } },
            { jackpot: {}, soonestExpiredFreeSpinSet: null },
        ];

        it.each(testCases)("when have soonestExpiredFreeSpinSet should call idCountersConsumer.consume", async (testCase) => {
            // arrange
            const gameData = {
                ingame: {
                    player1: { finish: false },
                },
                gameConfigs: {
                    slotsConfig: { jackpot: testCase.jackpot },
                },
            };

            const definition = { choicesMapper: {} };
            const placeBetPublisher = { publishGameFailedBet: jest.fn() };
            const freeSpinsConsumer = { getSoonestExpiredFreeSpinSet: jest.fn() };
            freeSpinsConsumer.getSoonestExpiredFreeSpinSet.mockReturnValueOnce(testCase.soonestExpiredFreeSpinSet);
            const jackpotValidator = { canContributeJackpotPools: jest.fn() };
            const idCountersConsumer = { consume: jest.fn() };
            const validateBalance = () => {
                return { isOk: false, response: { inSufficientBalance: false } };
            };
            const placeBet = () => {
                return { response: {} };
            };
            const baseMetrics = { collectBetProcessedTime: jest.fn() };
            const mockDeps = createMockDependencies();
            const cron = new SlotProcessBetQueue({
                gameData,
                definition,
                placeBetPublisher,
                freeSpinsConsumer,
                idCountersConsumer,
                validateBalance,
                placeBet,
                baseMetrics,
                jackpotValidator,
                ...mockDeps,
            });
            const player = { profile: { name: "player1" }, session: { disabledJackpotGames: false } };
            const payload = { freeSpin: false, betChoice: [] };

            // act
            await cron.proceedBet(player, payload);

            // assert
            expect(idCountersConsumer.consume).toBeCalled();
        });
    });

    describe("generateBetInfo", () => {
        describe("Jackpot is enabled", () => {
            const gameData = {
                gameConfigs: {
                    slotsConfig: {
                        jackpot: {
                            enabled: true,
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
                        },
                    },
                },
                currencies: [],
            };
            const jackpotValidator = new JackpotValidator(gameData);
            describe("When user can access jackpot", () => {
                const player = {
                    session: {
                        disableJackpotGames: false,
                    },
                };
                it("Should calculate contribution rate & amount with normal spin", async () => {
                    //Arrange
                    const payload = {
                        freeSpin: false,
                        amount: 0.1,
                        betChoice: [1, 2, 3],
                    };
                    const mockDeps = createMockDependencies();
                    const cron = new SlotProcessBetQueue({
                        gameData,
                        jackpotValidator,
                        ...mockDeps,
                    });

                    //Act
                    const result = await cron.generateBetInfo(payload, null, player);

                    //Assert
                    expect(result.contributionRate).toEqual(0.5);
                    expect(result.contributionAmount).toEqual(math.round(payload.amount * payload.betChoice.length * 0.5, 4));
                });

                it("contributionRate & contributionAmount should be 0 with free spin", async () => {
                    //Arrange
                    const payload = {
                        freeSpin: true,
                        amount: 0.1,
                        betChoice: [1, 2, 3],
                    };
                    const mockDeps = createMockDependencies();
                    const cron = new SlotProcessBetQueue({
                        gameData,
                        jackpotValidator,
                        ...mockDeps,
                    });

                    //Act
                    const result = await cron.generateBetInfo(payload, null, player);

                    //Assert
                    expect(result.contributionRate).toEqual(0);
                    expect(result.contributionAmount).toEqual(0);
                });
            });

            describe("When user can't access jackpot", () => {
                const player = {
                    session: {
                        disableJackpotGames: true,
                    },
                };
                it("contributionRate & contributionAmount should be 0", async () => {
                    //Arrange
                    const payload = {
                        freeSpin: false,
                        amount: 0.1,
                        betChoice: [1, 2, 3],
                    };
                    const mockDeps = createMockDependencies();
                    const cron = new SlotProcessBetQueue({
                        gameData,
                        jackpotValidator,
                        ...mockDeps,
                    });

                    //Act
                    const result = await cron.generateBetInfo(payload, null, player);

                    //Assert
                    expect(result.contributionRate).toEqual(0);
                    expect(result.contributionAmount).toEqual(0);
                });
            });
        });

        describe("Jackpot is disabled", () => {
            const gameData = {
                gameConfigs: {
                    slotsConfig: { jackpot: { enabled: false } },
                },
                currencies: [],
            };
            const jackpotValidator = new JackpotValidator(gameData);

            const player = {
                session: {
                    disableJackpotGames: false,
                },
            };
            it("contributionRate & contributionAmount should be 0", async () => {
                //Arrange
                const payload = {
                    freeSpin: false,
                    amount: 0.1,
                    betChoice: [1, 2, 3],
                };
                const mockDeps = createMockDependencies();
                const cron = new SlotProcessBetQueue({
                    gameData,
                    jackpotValidator,
                    ...mockDeps,
                });

                //Act
                const result = await cron.generateBetInfo(payload, null, player);

                //Assert
                expect(result.contributionRate).toEqual(0);
                expect(result.contributionAmount).toEqual(0);
            });
        });
    });
});
