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
            await this.processExpiredBonus();
        } else {
            this.bot && (await this.bot.run());
        }
    }

    async processExpiredBonus() {
        const expiryTime = moment.utc().add(-2, "minutes").toDate();
        const unsettleBets = Object.values(this.gameData.ingame).filter((currentBet) => currentBet.finish.time < expiryTime);

        return this.processUnsettledBets(unsettleBets);
    }

    async processUnsettledBets(needSettleBets) {
        await Promise.all(
            needSettleBets.map(async (bet) => {
                this.gameData.ingame[bet.name] = this.gameData.ingame[bet.name] ?? {};

                this.gameData.ingame[bet.name].finish = bet.finish;
                this.gameData.ingame[bet.name].bonusChests = bet.bonusChests;

                await this.bonusConsumer.autoOpenRemaningChests(bet.player);
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

        return unsettledBets.reduce((bets, currentBet) => {
            const { bonusChests, results, settlementResults, id, time } = currentBet;

            const player = {
                UID: currentBet.uid,
                profile: {
                    name: currentBet.name,
                },
                session: {
                    memberId: currentBet.memberId,
                },
            };

            bets.push({
                player,
                bonusChests,
                finish: {
                    id,
                    time,
                    results,
                    settlementResults,
                },
            });

            return bets;
        }, []);
    }
}
