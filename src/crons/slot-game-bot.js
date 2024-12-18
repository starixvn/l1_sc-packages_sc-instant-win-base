import mongoose from "mongoose";
import { Table } from "sc-game-base";
import * as Board from "./../board";
import * as EventConsumers from "./../event-consumers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class SlotGameBot extends Table.Crons.TableGameBot {
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
        publisher,
    }) {
        super(definition, gameData, publisher, userInfosRepository);

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

    standardizeBot(bot) {
        return {
            UID: bot.id,
            profile: {
                name: bot.name,
            },
        };
    }

    resetAllBotData() {
        const betLevelsConfigs = [...this.gameData.gameConfigs.slotsConfig?.betLevels] ?? [];

        this.totalNumberOfTickets = 0;
        this.odds = this.gameData.gameConfigs.slotsConfig?.icons ?? {};
        this.bigWinRatio = this.gameData.gameConfigs.slotsConfig?.bigWinRatio ?? 3;

        const ratios = [50, 30, 15, 5];

        const betLevelsPerGroup = Math.floor(betLevelsConfigs.length / ratios.length);

        this.groupTracks = ratios
            .map((ratio, index) => {
                const length = index === 0 ? betLevelsPerGroup + (betLevelsConfigs.length % ratios.length) : betLevelsPerGroup;
                return {
                    betLevels: betLevelsConfigs.splice(0, length),
                    ratio,
                    numberOfTickets: 0,
                };
            })
            .filter((x) => x.betLevels.length > 0);

        super.resetAllBotData();
    }

    async placeBet(bot) {
        await this.increaseRoundId();

        const standardizedBot = this.standardizeBot(bot);
        const { jackpot } = this.gameData.gameConfigs.slotsConfig;
        const name = standardizedBot.profile.name;
        const roundId = this.gameData.roundId;

        const numberOfPaylines = this.boardGenerator.numberOfPaylines;
        const paylines = [...Array(numberOfPaylines).keys()];
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
                await this.jackpotConsumer.hit(standardizedBot, {
                    prize,
                    roundId,
                    exchangeRateId: this.gameData.exchangeRates.exId,
                    rate: this.botRate,
                });
            }

            await this.jackpotConsumer.contribute(standardizedBot, { totalAmount, roundId, rate: this.botRate });
        }

        if (winningAmount > 0) {
            this.publisher.publishToAllUsers(bot.id, {
                winner: {
                    id: bot.id,
                    name: bot.name,
                    betWin: winningAmount,
                    bigWin: totalAmount * this.bigWinRatio <= winningAmount,
                    rate: this.botRate,
                },
            });
        }

        this.adjustGroupTracks(amount);
    }

    async increaseRoundId() {
        await this.idCountersConsumer.consume("round");
        this.gameData.roundId++;
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

    getTicketsPerRound() {
        return this.chance.integer({ min: 20, max: 100 });
    }
}
