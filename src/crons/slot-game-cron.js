import cron from "cron";
import { logger } from "sc-common";
import { Core } from "sc-game-base";

import { BonusConsumer, FreeSpinsConsumer, IdCountersConsumer, JackpotConsumer } from "./../event-consumers";

export default class SlotGameCron extends Core.Cron.BaseGameCron {
    constructor({
        definition,
        gameData,
        bot = null,
        settleGameRoundConsumer = null,
        gameStatusPublisher = null,
        runningRoundInfoPublisher = null,
        freeSpinsConsumer = null,
        bonusConsumer = null,
        idCountersConsumer = null,
        jackpotConsumer = null,
    }) {
        super(definition, gameData, bot, settleGameRoundConsumer, gameStatusPublisher, runningRoundInfoPublisher);

        this.freeSpinsConsumer = freeSpinsConsumer ?? new FreeSpinsConsumer(definition, gameData);
        this.bonusConsumer = bonusConsumer ?? new BonusConsumer(definition, gameData);
        this.idCountersConsumer = idCountersConsumer ?? new IdCountersConsumer(definition, gameData);
        this.jackpotConsumer = jackpotConsumer ?? new JackpotConsumer(definition, gameData);
    }

    async start() {
        this.gameData.roundId = await this.idCountersConsumer.getLatestId();

        await this.loadUnsettleBetsToIngame();
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
        }

        if (this.gameData.remainingTime < 0) {
            this.gameData.remainingTime = durations.wholeRound;

            await this.freeSpinsConsumer.reload();
            await this.bonusConsumer.processExpiredBonus();
        }
    }

    async loadUnsettleBetsToIngame() {
        const filter = {
            paid: false,
        };

        const projection = {
            _id: false,
            __v: false,
            __archive: false,
        };

        const bets = await this.definition.roundRepository
            .find(filter, projection, { sort: { id: -1 } })
            .lean()
            .exec();

        this.gameData.ingame = this.mapToIngameData(bets);
    }

    mapToIngameData(bets) {
        return bets.map((bet) => {
            const { bonusChests, results, settlementResults, id: roundId, time, uid: UID, name, memberId } = bet;

            const player = {
                UID,
                profile: { name },
                session: { memberId },
            };

            return {
                [name]: {
                    player,
                    bonusChests,
                    finish: {
                        roundId,
                        time,
                        results,
                        settlementResults,
                    },
                },
            };
        });
    }
}
