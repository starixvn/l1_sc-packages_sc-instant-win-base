import mongoose from "mongoose";
import GameData from "sc-game-base/src/core/game-data";
import { CurrencyRateHelper } from "./../helpers";

export default class HallOfFameQuery {
    /**
     * @param {Number} gameId
     * @param {mongoose.Model} famesRepository
     * @param {mongoose.Model} jackpotsRepository
     * @param {GameData} dependencies.gameData
     */
    constructor(gameId, famesRepository, jackpotsRepository, gameData) {
        this.gameId = gameId;
        this.famesRepository = famesRepository;
        this.jackpotsRepository = jackpotsRepository;
        this.gameData = gameData;
    }

    async queryBigWinningWinners(player, page, pageSize = 10) {
        if (page < 1 || pageSize < 1) {
            return { bigWinningWinners: {} };
        }

        const numberOfSkippedWinners = (page - 1) * pageSize;
        const total = await this.famesRepository.countDocuments().exec();
        const projection = {
            _id: false,
            time: true,
            name: true,
            totalAmount: true,
            winningAmount: true,
            freeSpin: true,
            rate: true,
        };
        const winners = await this.famesRepository
            .find({}, projection, { sort: { time: -1 }, skip: numberOfSkippedWinners, limit: pageSize })
            .lean()
            .exec();

        if (winners) {
            const playerRate = CurrencyRateHelper.calculateRate(player.session, this.gameData);

            winners.forEach((w) => {
                if (w.rate) {
                    w.totalAmount = (w.totalAmount * w.rate) / playerRate;
                    w.winningAmount = (w.winningAmount * w.rate) / playerRate;
                }
            });
        }

        return { bigWinningWinners: { winners, page, pageSize, total } };
    }

    async queryJackpotWinners(player, page, pageSize = 10) {
        if (page < 1 || pageSize < 1) {
            return { jackpotWinners: {} };
        }

        const filter = {
            gameId: this.gameId,
            winnerName: { $exists: true },
        };
        const numberOfSkippedWinners = (page - 1) * pageSize;
        const total = await this.jackpotsRepository.countDocuments(filter).exec();
        const projection = {
            _id: false,
            hitTime: true,
            winnerName: true,
            pool: true,
            amount: true,
            winningRatio: true,
        };
        const jackpotWinners = await this.jackpotsRepository
            .find(filter, projection, { sort: { hitTime: -1 }, skip: numberOfSkippedWinners, limit: pageSize })
            .lean()
            .exec();

        const playerRate = CurrencyRateHelper.calculateRate(player.session, this.gameData);
        const winners = jackpotWinners.map((jackpotWinner) => {
            const winningAmount = jackpotWinner.amount * jackpotWinner.winningRatio * playerRate;

            return {
                time: jackpotWinner.hitTime,
                name: jackpotWinner.winnerName,
                bet: jackpotWinner.pool,
                winningAmount,
            };
        });

        return { jackpotWinners: { winners, page, pageSize, total } };
    }
}
