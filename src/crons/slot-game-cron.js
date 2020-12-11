import moment from "moment";
import { Core } from "sc-game-base";

import BonusConsumer from "../consumers/bonus-consumer";
import FreeSpinsConsumer from "../consumers/free-spins-consumer";

export default class SlotGameCron extends Core.Cron.BaseGameCron {
    constructor(
        definition,
        gameData,
        bot = null,
        settleGameRoundConsumer = null,
        gameStatusPublisher = null,
        runningRoundInfoPublisher = null,
        freeSpinsConsumer = null,
        bonusConsumer = null
    ) {
        super(definition, gameData, bot, settleGameRoundConsumer, gameStatusPublisher, runningRoundInfoPublisher);

        this.freeSpinsConsumer = freeSpinsConsumer ?? new FreeSpinsConsumer(definition, gameData);
        this.bonusConsumer = bonusConsumer ?? new BonusConsumer(definition, gameData);
    }

    async start() {
        const unsettleBets = await this.loadUnsettledBets();
        await this.processUnsettledBets(unsettleBets);
        await this.freeSpinsConsumer.reload();

        await super.start();
    }

    async proceed() {
        const { durations } = this.definition;

        if (this.gameData.remainingTime === durations.wholeRound) {
            await this.checkGameStatus();
        }

        if (!this.gameData.disabled) {
            this.gameData.remainingTime--;
        }

        if (this.isStartingTime(this.gameData.remainingTime, durations)) {
            this.bot && (await this.bot.reset());
        }

        if (this.gameData.remainingTime < 0) {
            this.gameData.remainingTime = durations.wholeRound;

            await this.freeSpinsConsumer.reload();
            //TODO clean up game notifications, consider overlap freeSpins
            await this.processExpiredBonus();
        } else {
            this.bot && (await this.bot.run());
        }
    }

    async processExpiredBonus() {
        const expiryTime = moment.utc().subtract(this.definition.bonusLiveSeconds, "seconds").toDate();
        const unsettleBets = Object.values(this.gameData.ingame).filter((currentBet) => currentBet.finish.time < expiryTime);

        return this.processUnsettledBets(unsettleBets);
    }

    async processUnsettledBets(bets) {
        await Promise.all(
            bets.map(async (bet) => {
                const { bonusChests, finish } = bet;
                this.gameData.ingame[bet.name] = this.gameData.ingame[bet.name] ?? {};

                this.gameData.ingame[bet.name].finish = finish;
                this.gameData.ingame[bet.name].bonusChests = bonusChests;

                await this.bonusConsumer.autoOpenRemainingChests(bet.player);
            })
        );
    }

    async loadUnsettledBets() {
        const filter = {
            thanhtoan: false,
        };

        const projection = {
            _id: false,
            __v: false,
            __archive: false,
        };

        const unsettledBets = await this.definition.roundRepository
            .find(filter, projection, { sort: { id: -1 } })
            .lean()
            .exec();

        return unsettledBets.map((bet) => {
            const { bonusChests, results, settlementResults, id: roundId, time, uid: UID, name, memberId } = bet;

            const player = {
                UID,
                profile: { name },
                session: { memberId },
            };

            return {
                player,
                bonusChests,
                finish: {
                    roundId,
                    time,
                    results,
                    settlementResults,
                },
            };
        });
    }
}
