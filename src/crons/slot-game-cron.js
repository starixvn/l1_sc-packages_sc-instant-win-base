import cron from "cron";
import { Core } from "sc-game-base";

import { SlotGameBot } from "./../crons";
import * as EventConsumers from "./../event-consumers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class SlotGameCron extends Core.Crons.BaseGameCron {
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
     * @param {mongoose.Model} dependencies.archiveStatusesRepository
     * @param {mongoose.Model} dependencies.notificationRepository
     * @param {mongoose.Model} dependencies.exchangeRatesRepository
     * @param {mongoose.Model} dependencies.partnerConfigRepository
     * @param {EventConsumers.JackpotGameConsumer} dependencies.jackpotGameConsumer
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
        archiveStatusesRepository,
        notificationRepository,
        exchangeRatesRepository,
        currencyGroupGamesRepository,
        partnerConfigRepository,
        currencyGroupRepository,
        currencyRepository,
        jackpotGameConsumer,
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
            archiveStatusesRepository,
            notificationRepository,
            exchangeRatesRepository,
            currencyGroupGamesRepository,
            partnerConfigRepository,
            currencyGroupRepository,
            currencyRepository,
        });

        this.freeSpinsConsumer = freeSpinsConsumer;
        this.bonusConsumer = bonusConsumer;
        this.idCountersConsumer = idCountersConsumer;
        this.jackpotConsumer = jackpotConsumer;
        this.jackpotGameConsumer = jackpotGameConsumer;
    }

    async start() {
        await this.bot.resetInRoomTrackings();

        this.gameData.roundId = await this.idCountersConsumer.getLatestId("round");
        this.gameData.freeSpinId = await this.idCountersConsumer.getLatestId("freespin");

        if (this.gameData.roundId < 1 && this.gameData.freeSpinId < 1) {
            const { roundId, freeSpinId } = await this.getLastArchiveRound(this.gameData.gameConfigs.slotsConfig?.jackpot.enabled);

            await this.idCountersConsumer.updateLatestId("round", roundId);
            await this.idCountersConsumer.updateLatestId("freespin", freeSpinId);

            this.gameData.roundId = roundId;
            this.gameData.freeSpinId = freeSpinId;

            this.logService.logError(
                `${this.definition.name} get roundId #${this.gameData.roundId} and freeSpinId #${this.gameData.freeSpinId} from archive.`
            );
        }

        await this.loadUnsettledBetsToIngame();
        await this.jackpotGameConsumer.processExpired();
        await this.bonusConsumer.processExpiredBonus();
        await this.freeSpinsConsumer.reload();
        await this.getSettingForNewRound();
        await this.updateExchangeRates();

        if (this.gameData.gameConfigs.slotsConfig?.jackpot.enabled) {
            await this.jackpotConsumer.initialize();
        }

        const job = new cron.CronJob(
            "* * * * * *",
            () => this.proceed().catch(this.logService.logError),
            () => {
                this.logService.logError(
                    `${this.definition.name} unexpectedly stopped at round #${this.gameData.roundId} because some other tasks halt it.`
                );
                job.start();
            }
        );

        job.start();
    }

    async getLastArchiveRound(jackpotEnabled) {
        const { configName } = this.definition;
        const archiveStatus = await this.archiveStatusesRepository.findOne({ name: configName }, "lastArcId").lean().exec();
        const latestJackpotRoundId = jackpotEnabled ? await this.jackpotConsumer.getLatestRoundId() : 0;

        const roundId = archiveStatus && archiveStatus.lastArcId["_rounds"] > 0 ? archiveStatus.lastArcId["_rounds"] : 0;
        const freeSpinId = archiveStatus && archiveStatus.lastArcId["_freespins"] > 0 ? archiveStatus.lastArcId["_freespins"] : 0;

        return { roundId: Math.max(roundId, latestJackpotRoundId), freeSpinId };
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
        }

        await this.jackpotGameConsumer.processExpired();
        await this.bonusConsumer.processExpiredBonus();
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

        if (bets.length > 0) {
            this.logService.log(`${this.definition.configName} --- Running bets: ${bets.map((bet) => bet.id).toString()}`);
        }

        this.gameData.ingame = this.mapToIngameData(bets);
    }

    mapToIngameData(bets) {
        return bets.reduce((ingame, bet) => {
            const { bonusChests, result, settlementResult, id: roundId, time, uid: UID, name, playerId, currency, operatorId } = bet;

            const player = {
                UID,
                profile: { name },
                session: {
                    playerId,
                    currencyName: currency,
                    operatorId,
                },
            };
            const finish = {
                roundId,
                time,
                result,
                settlementResult,
            };

            if (bonusChests?.some((x) => !x.picked)) {
                if (settlementResult.jackpot && !settlementResult.jackpot.picked) {
                    finish.bonusTime = new Date(time.getTime() + this.definition.jackpotLiveSeconds * 1000);
                } else {
                    finish.bonusTime = time;
                }
            }

            ingame[name] = {
                name,
                player,
                bonusChests,
                finish,
                betQueue: [],
            };

            return ingame;
        }, {});
    }

    async updateCurrencyGroupGames() {
        this.gameData.currencyGroupGames = await this.currencyGroupGamesRepository
            .find({ gameId: this.definition.id, enabled: true }, "groupId minBet maxBet maxBetPerChoices chips betLevels defaultBetLevel")
            .lean()
            .exec();
    }

    publishStartGame() {}
}
