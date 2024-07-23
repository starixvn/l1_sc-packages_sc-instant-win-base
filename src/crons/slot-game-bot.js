import mongoose from "mongoose";
import { Core } from "sc-game-base";

import * as Board from "./../board";
import * as EventConsumers from "./../event-consumers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class SlotGameBot extends Core.Crons.BaseBot {
    /**
     * @param {Object} dependencies
     * @param {SlotGameDefinition} dependencies.definition
     * @param {SlotGameData} dependencies.gameData
     * @param {EventConsumers.JackpotConsumer} dependencies.jackpotConsumer
     * @param {EventConsumers.IdCountersConsumer} dependencies.idCountersConsumer
     * @param {EventConsumers.HallOfFameConsumer} dependencies.hallOfFameConsumer
     * @param {EventConsumers.BoardCheatingConsumer} dependencies.boardCheatingConsumer
     * @param {Board.BoardGenerator} dependencies.boardGenerator
     * @param {Board.PaylineCalculator} dependencies.paylineCalculator
     * @param {mongoose.Model} dependencies.userInfosRepository
     */
    constructor({
        definition,
        gameData,
        jackpotConsumer,
        idCountersConsumer,
        hallOfFameConsumer,
        boardCheatingConsumer,
        boardGenerator,
        paylineCalculator,
        userInfosRepository,
    }) {
        super(definition, gameData, userInfosRepository);

        this.idCountersConsumer = idCountersConsumer;
        this.jackpotConsumer = jackpotConsumer;
        this.hallOfFameConsumer = hallOfFameConsumer;
        this.boardCheatingConsumer = boardCheatingConsumer;
        this.boardGenerator = boardGenerator;
        this.paylineCalculator = paylineCalculator;

        this.totalNumberOfTickets = 0;
        this.odds = {};
        this.bigWinRatio = 0;
        this.stakeLevelsTracks = [];
    }

    async reset() {
        await super.reset();

        const configs = this.gameData.gameConfigs;

        if (configs?.botenabled) {
            const bots = await this.userInfosRepository.find({ type: true, disabled: false, inRoom: false }, "id name").lean().exec();

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

    resetAllBotData() {
        //TODO get from bet levels
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

        super.resetAllBotData();
    }

    async placeBet(bot) {
        await this.increaseRoundId();

        const { jackpot } = this.gameData.gameConfigs.slotsConfig;
        const name = bot.profile.name;
        const roundId = this.gameData.roundId;
        const paylines = this.randomizePaylines();
        const numberOfPaylines = paylines.length;
        const amount = this.getBetAmount();
        const totalAmount = amount * numberOfPaylines;
        const track = this.stakeLevelsTracks.find((track) => track.stake === amount);
        const generatedBoard = this.boardGenerator.generateForBots(jackpot.enabled, track.ratio);
        const board = this.boardCheatingConsumer.consume(name, generatedBoard);
        const betResult = this.paylineCalculator.calculate(board, paylines, this.odds);
        const winningAmount = betResult.paylines.reduce((currentWinningAmount, payline) => currentWinningAmount + payline.odds * amount, 0);

        if (jackpot.enabled) {
            //TODO need to play jackpot game
            if (betResult.jackpotPayline >= 0) {
                await this.jackpotConsumer.hit(bot, { pool: amount, roundId, exchangeRateId: this.gameData.exchangeRates.exId, rate: this.botRate });
            }

            await this.jackpotConsumer.contribute(bot, { totalAmount, roundId, rate: this.botRate });
        }

        if (totalAmount * this.bigWinRatio <= winningAmount) {
            await this.hallOfFameConsumer.add(bot, {
                roundId,
                bet: amount,
                totalAmount,
                baseTotalAmount: totalAmount * this.botRate,
                winningAmount,
                baseWinningAmount: winningAmount * this.botRate,
                numberOfPaylines,
                rate: this.botRate,
            });
        }

        this.adjustStakeLevelsTracks(amount);
    }

    async increaseRoundId() {
        await this.idCountersConsumer.consume("round");
        this.gameData.roundId++;
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
                underRatio: (track.numberOfTickets * 100) / this.totalNumberOfTickets < track.ratio,
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
