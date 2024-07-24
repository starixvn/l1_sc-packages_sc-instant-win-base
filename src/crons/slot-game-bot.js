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
        this.groupTracks = [];
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
        const betLevelsConfigs = [...this.gameData.gameConfigs.slotsConfig?.betLevels] ?? [];

        this.totalNumberOfTickets = 0;
        this.odds = this.gameData.gameConfigs.slotsConfig?.icons ?? {};
        this.bigWinRatio = this.gameData.gameConfigs.slotsConfig?.bigWinRatio ?? 3;

        const ratios = [50, 30, 15, 5];

        const betLevelsPerGroup = Math.floor(betLevelsConfigs.length / ratios.length);

        this.groupTracks = ratios.map((ratio, index) => {
            const length = index === 0 ? betLevelsPerGroup + (betLevelsConfigs.length % ratios.length) : betLevelsPerGroup;
            return {
                betLevels: betLevelsConfigs.splice(0, length),
                ratio,
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
        const track = this.groupTracks.find((track) => track.betLevels.includes(amount));
        const generatedBoard = this.boardGenerator.generateForBots(jackpot.enabled, track.ratio);
        const board = this.boardCheatingConsumer.consume(name, generatedBoard);
        const betResult = this.paylineCalculator.calculate(board, paylines, this.odds);
        const winningAmount = betResult.paylines.reduce((currentWinningAmount, payline) => currentWinningAmount + payline.odds * amount, 0);

        if (jackpot.enabled) {
            if (betResult.jackpotPayline >= 0) {
                const prize = this.chance.weighted(
                    Object.keys(jackpot.pools),
                    Object.values(jackpot.pools).map((pool) => pool.botSettings.alloc)
                );
                await this.jackpotConsumer.hit(bot, { prize, roundId, exchangeRateId: this.gameData.exchangeRates.exId, rate: this.botRate });
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

        this.adjustGroupTracks(amount);
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
        const ratiosPerGroup = this.groupTracks.map((track) => {
            return {
                betLevels: track.betLevels,
                underRatio: (track.numberOfTickets * 100) / this.totalNumberOfTickets < track.ratio,
            };
        });
        const underRatioGroups = this.chance.shuffle(ratiosPerGroup.filter((group) => group.underRatio));

        const selectedGroup = underRatioGroups.length > 0 ? underRatioGroups[0] : this.randomizeGroup();

        return this.chance.pickone(selectedGroup.betLevels);
    }

    randomizeGroup() {
        const randomIndex = this.chance.natural({ min: 0, max: this.groupTracks.length - 1 });

        return this.groupTracks[randomIndex];
    }

    adjustGroupTracks(betAmount) {
        const group = this.groupTracks.find((track) => track.betLevels.includes(betAmount));

        if (group) {
            group.numberOfTickets++;
        }

        this.totalNumberOfTickets++;
    }
}
