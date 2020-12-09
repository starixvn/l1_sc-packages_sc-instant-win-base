import Chance from "chance";
import { userInfos } from "sc-base-database";
import { Core } from "sc-game-base";

import BoardGenerator from "./../../board/board-generator";
import PaylineCalculator from "./../../board/payline-calculator";
import HallOfFameConsumer from "./../../consumers/hall-of-fame-consumer";
import JackpotConsumer from "./../../consumers/jackpot-consumer";
import SlotGameData from "./../../slot-game-data";
import SlotGameDefinition from "./../../slot-game-definition";

export default class SlotGameBot extends Core.Cron.BaseBot {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {Core.BaseEventPublishers.BasePublisher} publisher
     * @param {JackpotConsumer} jackpotConsumer
     * @param {HallOfFameConsumer} hallOfFameConsumer
     * @param {BoardGenerator} boardGenerator
     * @param {PaylineCalculator} paylineCalculator
     */

    constructor(definition, gameData, publisher, jackpotConsumer = null, hallOfFameConsumer = null, boardGenerator = null, paylineCalculator = null) {
        super(definition, gameData, publisher);

        this.jackpotConsumer = jackpotConsumer ?? new JackpotConsumer(definition, gameData);
        this.hallOfFameConsumer = hallOfFameConsumer ?? new HallOfFameConsumer(definition);
        this.boardGenerator = boardGenerator ?? new BoardGenerator();
        this.paylineCalculator = paylineCalculator ?? new PaylineCalculator();

        this.bots = [];
        this.totalNumberOfTickets = 0;
        this.odds = {};
        this.bigWinRatio = 0;
        this.stakeLevelsTracks = [];

        this.chance = new Chance();
    }

    async reset() {
        await super.reset();

        const configs = this.gameData.gameConfigs;

        if (configs?.botenabled) {
            const bots = await userInfos.find({ type: true, disabled: false }, "id name").lean().exec();

            this.bots = this.chance.shuffle(this.standardizeBots(bots)).slice(0, this.maxNumberOfBots);
        } else {
            this.bots = [];
        }
    }

    standardizeBots(bots) {
        return bots.map((bot) => {
            return {
                UID: bot.id,
                profile: {
                    name: bot.name,
                },
            };
        });
    }

    async removeAllBots() {
        this.bots = [];
    }

    resetAllBotData() {
        const stakeLevelsConfigs = this.gameData.gameConfigs.slotsConfig?.stakeLevels ?? [];

        this.totalNumberOfTickets = 0;
        this.odds = this.gameData.gameConfigs.slotsConfig?.icons ?? {};
        this.bigWinRatio = this.gameData.gameConfigs.slotsConfig?.bigWinRatio ?? 3;
        this.stakeLevelsTracks = stakeLevelsConfigs.map((config) => {
            return {
                stake: config.stake,
                ratio: config.botRatio,
                numberOfTickets: 0,
            };
        });
    }

    async run() {
        if (this.bots.length === 0 || !this.gameData.gameConfigs?.botenabled) {
            return;
        }

        const maxBotRandom = this.bots.length / this.gameData.remainingTime;
        const botsToBet = this.chance.integer({ min: (maxBotRandom * 2) / 3, max: maxBotRandom });
        const indicesOfBotsToBeRemoved = [];

        for (let botIndex = 0; botIndex < botsToBet; botIndex++) {
            const bot = this.bots[botIndex];

            if (bot) {
                await this.placeBet(bot);
                indicesOfBotsToBeRemoved.push(bot);
            }
        }

        indicesOfBotsToBeRemoved.forEach((index) => {
            this.bots.splice(index, 1);
        });
    }

    async placeBet(bot) {
        const roundId = this.gameData.roundId;
        const paylines = this.randomizePaylines();
        const numberOfPaylines = paylines.length;
        const amount = this.getBetAmount();
        const totalAmount = amount * numberOfPaylines;
        const board = this.boardGenerator.generateForBots();
        const betResult = this.paylineCalculator.calculate(board, paylines, this.odds);
        const winningAmount = betResult.paylines.reduce((currentWinningAmount, payline) => {
            currentWinningAmount += payline.odds * amount;

            return currentWinningAmount;
        }, 0);

        // TODO: overwrite result from admin

        this.gameData.roundId++;

        if (betResult.jackpot) {
            await this.jackpotConsumer.hit(bot, { pool: amount, roundId });
        }

        await this.jackpotConsumer.contribute(bot, { pool: amount, totalAmount, roundId });

        if (totalAmount * this.bigWinRatio <= winningAmount) {
            this.hallOfFameConsumer.add(bot, { roundId, bet: amount, numberOfPaylines, totalAmount, winningAmount });
        }

        this.adjustStakeLevelsTracks(amount);
    }

    randomizePaylines() {
        const numberOfAvailablePaylines = this.boardGenerator.numberOfPaylines;
        const seeds = [...Array(numberOfAvailablePaylines).keys()];
        const numberOfPaylines = this.chance.natural({ min: 1, max: numberOfAvailablePaylines - 1 });

        return this.chance.pickset(seeds, numberOfPaylines);
    }

    getBetAmount() {
        const ratiosPerStakeLevel = this.stakeLevelsTracks.map((track) => {
            return {
                stake: track.stake,
                underRatio: (track.numberOfTickets * 100) / this.totalNumberOfTickets < trac.ratio,
            };
        });
        const underRatioStakeLevels = this.chance.shuffle(ratiosPerStakeLevel.filter((stakeLevel) => stakeLevel.underRatio));

        return underRatioStakeLevels.length > 0 ? underRatioStakeLevels[0].stake : this.randomizeStakeLevel();
    }

    randomizeStakeLevel() {
        const randomStakeLevelIndex = this.chance.natural({ min: 0, max: this.stakeLevelsTracks.length - 1 });

        return this.stakeLevelsTracks[randomStakeLevelIndex].stake;
    }

    adjustStakeLevelsTracks(betAmount) {
        const stakeLevel = this.stakeLevelsTracks.find((track) => track.stake === betAmount);

        if (stakeLevel) {
            stakeLevel.numberOfTickets++;
        }

        this.totalNumberOfTickets++;
    }
}
