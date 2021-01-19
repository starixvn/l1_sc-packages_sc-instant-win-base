import cron from "cron";
import { logger } from "sc-common";
import { Core } from "sc-game-base";

import { SlotGameBot } from "./../crons";
import * as EventConsumers from "./../event-consumers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class SlotGameCron extends Core.Cron.BaseGameCron {
    /**
     * @param {Object} dependencies
     * @param {SlotGameDefinition} dependencies.definition
     * @param {SlotGameData} dependencies.gameData
     * @param {SlotGameBot} dependencies.bot
     * @param {EventConsumers.SettleGameRoundConsumer} dependencies.settleGameRoundConsumer
     * @param {EventConsumers.FreeSpinsConsumer} dependencies.freeSpinsConsumer
     * @param {EventConsumers.BonusConsumer} dependencies.bonusConsumer
     * @param {EventConsumers.IdCountersConsumer} dependencies.idCountersConsumer
     * @param {EventConsumers.JackpotConsumer} dependencies.jackpotConsumer
     * @param {Core.BaseEventPublishers.GameStatusPublisher} dependencies.gameStatusPublisher
     * @param {Core.BaseEventPublishers.RunningRoundInfoPublisher} dependencies.runningRoundInfoPublisher
     * @param {logger} dependencies.logService
     * @param {mongoose.Model} dependencies.gameConfigsRepository
     * @param {mongoose.Model} dependencies.roundsRepository
     */
    constructor({
        definition,
        gameData,
        bot,
        settleGameRoundConsumer,
        freeSpinsConsumer,
        bonusConsumer,
        idCountersConsumer,
        jackpotConsumer,
        gameStatusPublisher,
        runningRoundInfoPublisher,
        logService,
        gameConfigsRepository,
        roundsRepository,
    }) {
        super({
            definition,
            gameData,
            bot,
            settleGameRoundConsumer,
            gameStatusPublisher,
            runningRoundInfoPublisher,
            logService,
            gameConfigsRepository,
            roundsRepository,
        });

        this.freeSpinsConsumer = freeSpinsConsumer;
        this.bonusConsumer = bonusConsumer;
        this.idCountersConsumer = idCountersConsumer;
        this.jackpotConsumer = jackpotConsumer;
    }

    async start() {
        this.gameData.roundId = await this.idCountersConsumer.getLatestId();

        await this.loadUnsettledBetsToIngame();
        await this.bonusConsumer.processExpiredBonus();
        await this.freeSpinsConsumer.reload();
        await this.jackpotConsumer.initialize();

        const job = new cron.CronJob(
            "* * * * * *",
            () => this.proceed().catch(logger.logError),
            () => {
                logger.logError(`${this.definition.name} unexpectedly stopped at round #${this.gameData.roundId} because some other tasks halt it.`);
                job.start();
            }
        );

        job.start();
    }

    async proceed() {
        const { durations } = this.definition;

        if (this.gameData.remainingTime === durations.wholeRound) {
            await this.checkGameStatus();
            this.bot && (await this.bot.reset());
        }

        if (!this.gameData.disabled) {
            this.gameData.remainingTime--;
            this.bot && (await this.bot.run());
            await this.bonusConsumer.processExpiredBonus();
        }

        if (this.gameData.remainingTime < 0) {
            this.gameData.remainingTime = durations.wholeRound;

            await this.freeSpinsConsumer.reload();
        }
    }

    async loadUnsettledBetsToIngame() {
        const filter = {
            paid: false,
        };
        const projection = {
            _id: false,
            __v: false,
            __archive: false,
            siteId: false,
            bet: false,
            totalAmount: false,
            odds: false,
            betWin: false,
            endTime: false,
            freeSpin: false,
        };
        const sort = { id: -1 };
        const bets = await this.roundsRepository.find(filter, projection, { sort }).lean().exec();

        this.gameData.ingame = this.mapToIngameData(bets);
    }

    mapToIngameData(bets) {
        return bets.reduce((ingame, bet) => {
            const { bonusChests, result, settlementResult, id: roundId, time, uid: UID, name, memberId, jackpot } = bet;

            const player = {
                UID,
                profile: { name },
                session: { memberId },
            };

            ingame[name] = {
                player,
                bonusChests,
                finish: {
                    roundId,
                    time,
                    result,
                    settlementResult,
                    jackpotWin: jackpot?.winningAmount ?? 0,
                },
            };

            return ingame;
        }, {});
    }
}
