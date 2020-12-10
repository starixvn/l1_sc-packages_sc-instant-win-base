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
        await this.processUnsettledBets();
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

            //TODO expired freeSpins
            //TODO expired bonus
        } else if (this.gameData.remainingTime < durations.placingBets) {
            this.bot && (await this.bot.run());
        }
    }

    async processUnsettledBets() {
        const unsettleBets = await this.loadUnsettledBets();

        unsettleBets.forEach((bet) => {
            this.gameData.ingame[bet.name] = bet;
        });
    }

    async loadUnsettledBets() {
        const filter = {
            thanhtoan: false,
        };

        const projection = {
            _id: false,
            uid: false,
            memberId: false,
            __v: false,
            __archive: false,
        };

        const unsettledBets = await this.definition.roundRepository
            .find(filter, projection, { sort: { id: -1 } })
            .lean()
            .exec();

        return unsettledBets.reduce((bets, currentBet) => {
            const { name, bonusChests, results, settlementResults, id, time } = currentBet;

            bets.push({
                name,
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
