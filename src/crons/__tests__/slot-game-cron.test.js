import SlotGameCron from "../slot-game-cron";
import { Core } from "sc-game-base";
import mongoose from "mongoose";
import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";

const roundsRepository = stubMongooseModelStupidly(mongoose.Model);
const archiveStatusesRepository = stubMongooseModelStupidly(mongoose.Model);
const exchangeRatesRepository = stubMongooseModelStupidly(mongoose.Model);

jest.mock("cron", () => {
    const mScheduleJob = {
        called: false,
        onTick: () => jest.fn(),
        onComplete: () => jest.fn(),
        start: () => {
            if (mScheduleJob.called) {
                return;
            }

            mScheduleJob.called = true;
            mScheduleJob.onTick();
            mScheduleJob.onComplete();
        },
    };

    const mCronJob = jest.fn((cronTime, onTick, onComplete) => {
        mScheduleJob.called = false;
        mScheduleJob.cronTime = cronTime;
        mScheduleJob.onTick = onTick;
        mScheduleJob.onComplete = onComplete;

        return mScheduleJob;
    });

    return { CronJob: mCronJob };
});

describe("slot-game-cron", () => {
    describe("extends", () => {
        it("should extend Core.Crons.BaseBot", () => {
            // act
            const cron = new SlotGameCron({});

            // assert
            expect(cron instanceof Core.Crons.BaseGameCron);
        });
    });

    describe("start", () => {
        it("should call correct function", async () => {
            // arrange
            const gameData = {
                gameConfigs: { slotsConfig: { jackpot: { enabled: false } } },
            };

            const idCountersConsumer = { getLatestId: jest.fn() };
            const logService = { logError: jest.fn() };
            const bonusConsumer = { processExpiredBonus: jest.fn() };
            const freeSpinsConsumer = { reload: jest.fn() };
            const definition = {};
            const cron = new SlotGameCron({
                gameData,
                definition,
                idCountersConsumer,
                logService,
                bonusConsumer,
                freeSpinsConsumer,
                roundsRepository,
                exchangeRatesRepository,
            });
            roundsRepository
                .find()
                .lean()
                .exec.mockReturnValue([{ id: 1 }]);

            // act
            await cron.start();

            // assert
            expect(bonusConsumer.processExpiredBonus).toBeCalled();
            expect(freeSpinsConsumer.reload).toBeCalled();
        });

        it("should start CronJob", async () => {
            // arrange
            const gameData = {
                gameConfigs: { slotsConfig: { jackpot: { enabled: false } } },
            };

            const idCountersConsumer = { getLatestId: jest.fn() };
            const logService = { logError: jest.fn() };
            const bonusConsumer = { processExpiredBonus: jest.fn() };
            const freeSpinsConsumer = { reload: jest.fn() };
            const definition = {};
            const cron = new SlotGameCron({
                gameData,
                definition,
                idCountersConsumer,
                logService,
                bonusConsumer,
                freeSpinsConsumer,
                roundsRepository,
                exchangeRatesRepository,
            });
            roundsRepository
                .find()
                .lean()
                .exec.mockReturnValue([{ id: 1 }]);

            // act
            await cron.start();

            // assert
            expect(logService.logError).toBeCalled();
        });

        it("when not have roundId and freeSpinId should updateLatestId for roundId and freeSpinId", async () => {
            // arrange
            const gameData = {
                gameConfigs: { slotsConfig: { jackpot: { enabled: false } } },
            };

            const idCountersConsumer = { getLatestId: jest.fn(), updateLatestId: jest.fn() };
            idCountersConsumer.getLatestId.mockReturnValue(0);
            const logService = { logError: jest.fn() };
            const bonusConsumer = { processExpiredBonus: jest.fn() };
            const freeSpinsConsumer = { reload: jest.fn() };
            const definition = {};
            const cron = new SlotGameCron({
                gameData,
                definition,
                idCountersConsumer,
                logService,
                bonusConsumer,
                freeSpinsConsumer,
                roundsRepository,
                exchangeRatesRepository,
            });
            cron.getLastArchiveRound = jest.fn();
            cron.getLastArchiveRound.mockReturnValueOnce({ roundId: 3, freeSpinId: 5 });

            roundsRepository
                .find()
                .lean()
                .exec.mockReturnValue([{ id: 1 }]);

            // act
            await cron.start();

            // assert
            expect(idCountersConsumer.updateLatestId).toBeCalledWith("round", 3);
            expect(idCountersConsumer.updateLatestId).toBeCalledWith("freespin", 5);
        });

        it("when enable jackpot should call jackpotConsumer.initialize", async () => {
            // arrange
            const gameData = {
                gameConfigs: { slotsConfig: { jackpot: { enabled: true } } },
            };

            const idCountersConsumer = { getLatestId: jest.fn(), updateLatestId: jest.fn() };
            idCountersConsumer.getLatestId.mockReturnValue(0);
            const logService = { logError: jest.fn() };
            const bonusConsumer = { processExpiredBonus: jest.fn() };
            const freeSpinsConsumer = { reload: jest.fn() };
            const jackpotConsumer = { initialize: jest.fn() };
            const definition = {};
            const cron = new SlotGameCron({
                gameData,
                definition,
                idCountersConsumer,
                logService,
                bonusConsumer,
                freeSpinsConsumer,
                roundsRepository,
                jackpotConsumer,
                exchangeRatesRepository,
            });
            cron.getLastArchiveRound = jest.fn();
            cron.getLastArchiveRound.mockReturnValueOnce({ roundId: 3, freeSpinId: 5 });

            roundsRepository
                .find()
                .lean()
                .exec.mockReturnValue([{ id: 1 }]);

            // act
            await cron.start();

            // assert
            expect(jackpotConsumer.initialize).toBeCalled();
        });
    });

    describe("getLastArchiveRound", () => {
        const testCases = [
            {
                jackpotEnabled: false,
                expectedValue: { roundId: 1, freeSpinId: 2 },
                archiveStatus: { lastArcId: { _rounds: 1, _freespins: 2 } },
            },
            {
                jackpotEnabled: true,
                expectedValue: { roundId: 10, freeSpinId: 2 },
                archiveStatus: { lastArcId: { _rounds: 1, _freespins: 2 } },
            },
            {
                jackpotEnabled: false,
                expectedValue: { roundId: 0, freeSpinId: 0 },
                archiveStatus: undefined,
            },
            {
                jackpotEnabled: false,
                expectedValue: { roundId: 0, freeSpinId: 0 },
                archiveStatus: { lastArcId: {} },
            },
        ];

        it.each(testCases)("should return correct info", async (testCase) => {
            // arrange
            const definition = {};
            const jackpotConsumer = { getLatestRoundId: jest.fn() };
            jackpotConsumer.getLatestRoundId.mockReturnValueOnce(10);

            const cron = new SlotGameCron({ definition, archiveStatusesRepository, jackpotConsumer });
            archiveStatusesRepository.findOne().lean().exec.mockReturnValueOnce(testCase.archiveStatus);

            // act
            const actualValue = await cron.getLastArchiveRound(testCase.jackpotEnabled);

            // assert
            expect(actualValue).toStrictEqual(testCase.expectedValue);
        });
    });

    describe("proceed", () => {
        const definition = { durations: { wholeRound: 45 } };
        const bonusConsumer = { processExpiredBonus: jest.fn() };

        it("should processExpiredBonus", async () => {
            // arrange
            const gameData = { remainingTime: 1 };
            const cron = new SlotGameCron({ definition, gameData, bonusConsumer });
            cron.checkGameStatus = jest.fn();

            // act
            await cron.proceed();

            // assert
            expect(bonusConsumer.processExpiredBonus).toBeCalled();
        });

        it("when remainingTime === durations.wholeRound and not have bot should checkGameStatus", async () => {
            // arrange
            const gameData = { remainingTime: 45 };
            const cron = new SlotGameCron({ definition, gameData, bonusConsumer });
            cron.checkGameStatus = jest.fn();

            // act
            await cron.proceed();

            // assert
            expect(cron.checkGameStatus).toBeCalled();
        });

        it("when remainingTime === durations.wholeRound and have bot should reset bot", async () => {
            // arrange
            const gameData = { remainingTime: 45 };
            const bot = stub(Core.Crons.BaseBot);
            const cron = new SlotGameCron({ definition, gameData, bonusConsumer, bot });
            cron.checkGameStatus = jest.fn();

            // act
            await cron.proceed();

            // assert
            expect(bot.reset).toBeCalled();
        });

        it("when game not disabled and not have bot should reduce remainingTime", async () => {
            // arrange
            const gameData = { remainingTime: 45 };
            const cron = new SlotGameCron({ definition, gameData, bonusConsumer });
            cron.checkGameStatus = jest.fn();

            // act
            await cron.proceed();

            // assert
            expect(cron.gameData.remainingTime).toBe(44);
        });

        it("when game disabled and not have bot should not reduce remainingTime", async () => {
            // arrange
            const gameData = { remainingTime: 45, disabled: true };
            const cron = new SlotGameCron({ definition, gameData, bonusConsumer });
            cron.checkGameStatus = jest.fn();

            // act
            await cron.proceed();

            // assert
            expect(cron.gameData.remainingTime).toBe(45);
        });

        it("when game not disabled and have bot should run bot", async () => {
            // arrange
            const gameData = { remainingTime: 45 };
            const bot = stub(Core.Crons.BaseBot);
            const cron = new SlotGameCron({ definition, gameData, bonusConsumer, bot });
            cron.checkGameStatus = jest.fn();

            // act
            await cron.proceed();

            // assert
            expect(bot.run).toBeCalled();
        });

        it("when remainingTime < 0 should call freeSpinsConsumer.reload", async () => {
            // arrange
            const gameData = { remainingTime: -1 };
            const freeSpinsConsumer = { reload: jest.fn() };
            const cron = new SlotGameCron({ definition, gameData, bonusConsumer, freeSpinsConsumer });
            cron.checkGameStatus = jest.fn();

            // act
            await cron.proceed();

            // assert
            expect(freeSpinsConsumer.reload).toBeCalled();
        });
    });
});
