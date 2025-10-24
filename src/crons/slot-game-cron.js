import cron from "cron";
import { Core } from "sc-game-base";

import { SlotGameBot } from "./../crons";
import * as EventConsumers from "./../event-consumers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

/**
 * SLOT GAME CRON - Game Engine Heartbeat
 *
 * PURPOSE:
 * Manages the game's timing engine and background processes.
 * Runs every second to advance game state, process bets, and maintain system health.
 *
 * CRON RESPONSIBILITIES:
 * 1. **Round Management**: Advances game rounds every wholeRound seconds
 * 2. **Bet Processing**: Processes queued bets and settles completed rounds
 * 3. **Bot Management**: Controls automated players for game activity
 * 4. **Cleanup Tasks**: Expires abandoned bonus games and free spins
 * 5. **Data Synchronization**: Reloads free spins and updates currencies
 * 6. **System Health**: Ensures jackpot pools are initialized and running
 *
 * EXECUTION CYCLE:
 * - Runs every 1 second (* * * * * *)
 * - Each cycle advances remainingTime by -1
 * - When remainingTime reaches 0, processes round completion
 * - Handles round rollover and state resets
 */
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
     * @param {mongoose.Model} dependencies.roundsRepository
     * @param {EventConsumers.JackpotGameConsumer} dependencies.jackpotGameConsumer
     * @param {GameManagementApiClientFactory} dependencies.gameManagementApiClientFactory
     * @param {EventConsumers.RoundResultConsumer} dependencies.roundResultConsumer
     * @param {mongoose.Model} dependencies.resultsRepository
     * @param {Object} dependencies.appConfigs
     * @param {EventConsumers.RoundIdConsumer} dependencies.roundIdConsumer
     * @param {EventConsumers.ProvablyFairConsumer} dependencies.provablyFairConsumer
     * @param {EventConsumers.UnsettledRoundConsumer} dependencies.unsettledRoundConsumer
     * @param {EventConsumers.PromotionFreeSpinsConsumer} dependencies.promotionFreeSpinsConsumer
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
        roundsRepository,
        jackpotGameConsumer,
        progressBonusConsumer,
        gameManagementApiClientFactory,
        roundResultConsumer,
        resultsRepository,
        appConfigs,
        roundIdConsumer,
        provablyFairConsumer,
        unsettledRoundConsumer,
        promotionFreeSpinsConsumer,
    }) {
        super({
            definition,
            gameData,
            bot,
            settleGameRoundConsumer,
            gameStatusPublisher,
            runningRoundInfoPublisher,
            logService,
            gameManagementApiClientFactory,
            roundResultConsumer,
            resultsRepository,
            appConfigs,
            roundIdConsumer,
            provablyFairConsumer,
            unsettledRoundConsumer,
            promotionFreeSpinsConsumer,
        });

        this.freeSpinsConsumer = freeSpinsConsumer;
        this.bonusConsumer = bonusConsumer;
        this.idCountersConsumer = idCountersConsumer;
        this.jackpotConsumer = jackpotConsumer;
        this.jackpotGameConsumer = jackpotGameConsumer;
        this.progressBonusConsumer = progressBonusConsumer;
        this.roundsRepository = roundsRepository;
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
        await this.progressBonusConsumer.initialize();

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
        const archiveStatusResponse = await this.gameManagementApiClient.archiveStatus.getArchiveStatus(configName);
        const archiveStatus = archiveStatusResponse?.data;
        const latestJackpotRoundId = jackpotEnabled ? await this.jackpotConsumer.getLatestRoundId() : 0;

        const roundId = archiveStatus && archiveStatus.lastArcId && archiveStatus.lastArcId["_rounds"] > 0 ? archiveStatus.lastArcId["_rounds"] : 0;
        const freeSpinId =
            archiveStatus && archiveStatus.lastArcId && archiveStatus.lastArcId["_freespins"] > 0 ? archiveStatus.lastArcId["_freespins"] : 0;

        return { roundId: Math.max(roundId, latestJackpotRoundId), freeSpinId };
    }

    /**
     * MAIN CRON EXECUTION CYCLE - Runs Every Second
     *
     * This is the heartbeat of the game engine. Each second this method:
     * 1. Advances the game timer
     * 2. Processes round transitions
     * 3. Manages bot activity
     * 4. Handles cleanup tasks
     *
     * Timing Logic:
     * - remainingTime starts at durations.wholeRound (e.g., 30 seconds)
     * - Each second: remainingTime--
     * - When remainingTime reaches 0: Round completes, reset to wholeRound
     * - Special handling at round start/completion boundaries
     */
    async proceed() {
        const { durations } = this.definition;

        // ROUND START: When timer resets to full round duration
        if (this.gameData.remainingTime === durations.wholeRound) {
            await this.checkGameStatus();  // Verify game is operational
            this.bot && (await this.bot.reset());  // Reset bot states
        }

        // NORMAL TICK: Advance game state if not disabled
        if (!this.gameData.disabled) {
            this.gameData.remainingTime--;  // Count down to round end
            this.bot && (await this.bot.run());  // Execute bot actions
        }

        // ROUND COMPLETION: When timer reaches zero
        if (this.gameData.remainingTime < 0) {
            this.gameData.remainingTime = durations.wholeRound;  // Reset for next round

            // Reload free spins data to ensure synchronization
            await this.freeSpinsConsumer.reload();
        }

        // CONTINUOUS MAINTENANCE TASKS (run every second)
        await this.jackpotGameConsumer.processExpired();  // Clean up expired jackpot games
        await this.bonusConsumer.processExpiredBonus();   // Auto-complete abandoned bonuses
        this.progressBonusConsumer.processCountdown();    // Update bonus timers
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
        await super.updateCurrencyGroupGames();
    }

    publishStartGame() {}
}
