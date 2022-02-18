import SlotProcessBetQueue from "../slot-process-bet-queue";
import { Core } from "sc-game-base";

describe("slot-process-bet-queue", () => {
    describe("extends", () => {
        it("should extend Core.Crons.BaseBot", () => {
            // act
            const cron = new SlotProcessBetQueue({});

            // assert
            expect(cron instanceof Core.Crons.ProcessBetQueue);
        });
    });

    describe("generatePlacingBetResult", () => {
        it("should return correct value", () => {
            // arrange
            const cron = new SlotProcessBetQueue({});
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
            const gameData = { exchangeRates: {} };
            const cron = new SlotProcessBetQueue({ roundsRepository, gameData });
            const player = { session: { memberId: 1, playerId: 1, siteId: 2 }, profile: { name: "user3" } };
            const bet = { totalAmount: 10, freeSpin: 1 };

            // act
            await cron.upsertBet(player, 1, bet);

            // assert
            expect(roundsRepository.create).toHaveBeenCalledWith(expect.objectContaining({ memberId: 1, playerId: 1, siteId: 2 }));
        });

        it("when not have player session should create correct info", async () => {
            // arrange
            const roundsRepository = { create: jest.fn() };
            const gameData = { exchangeRates: {} };
            const cron = new SlotProcessBetQueue({ roundsRepository, gameData });
            const player = { profile: { name: "user3" }, session: null };
            const bet = { totalAmount: 10, freeSpin: 1 };

            // act
            await cron.upsertBet(player, 1, bet);

            // assert
            expect(roundsRepository.create).toHaveBeenCalledWith(expect.objectContaining({ name: "user3" }));
        });
    });

    describe("handleSuccessBet", () => {
        it("should call settleGameRoundConsumer.settleRound", async () => {
            // arrange
            const settleGameRoundConsumer = { settleRound: jest.fn() };
            const gameData = { exchangeRates: { code: [] } };
            const cron = new SlotProcessBetQueue({ settleGameRoundConsumer, gameData });
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
            const freeSpinsConsumer = { useFreeSpin: jest.fn() };
            const gameData = { exchangeRates: { code: [] } };
            const cron = new SlotProcessBetQueue({ settleGameRoundConsumer, freeSpinsConsumer, gameData });
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
            const cron = new SlotProcessBetQueue({});

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

            const cron = new SlotProcessBetQueue({ definition, gameData });
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
            const cron = new SlotProcessBetQueue({ gameData, placeBetPublisher });
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
            const cron = new SlotProcessBetQueue({ gameData, placeBetPublisher, freeSpinsConsumer });
            const player = { profile: { name: "player1" } };
            const payload = { freeSpin: true };

            // act
            await cron.proceedBet(player, payload);

            // assert
            expect(placeBetPublisher.publishGameFailedBet).toBeCalled();
        });

        const testCases = [
            { jackpot: { playerContributionRatio: 5 }, soonestExpiredFreeSpinSet: { bet: 1, paylines: [] } },
            { jackpot: undefined, soonestExpiredFreeSpinSet: null },
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

            const idCountersConsumer = { consume: jest.fn() };
            const validateBalance = () => {
                return { isOk: false, response: { inSufficientBalance: false } };
            };
            const placeBet = () => {
                return { response: {} };
            };
            const baseMetrics = { collectBetProcessedTime: jest.fn() };
            const cron = new SlotProcessBetQueue({
                gameData,
                definition,
                placeBetPublisher,
                freeSpinsConsumer,
                idCountersConsumer,
                validateBalance,
                placeBet,
                baseMetrics,
            });
            const player = { profile: { name: "player1" } };
            const payload = { freeSpin: false, betChoice: [] };

            // act
            await cron.proceedBet(player, payload);

            // assert
            expect(idCountersConsumer.consume).toBeCalled();
        });
    });
});
