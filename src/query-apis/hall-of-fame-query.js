import mongoose from "mongoose";

export default class HallOfFameQuery {
    /**
     * @param {Number} gameId
     * @param {mongoose.Model} famesRepository
     * @param {mongoose.Model} jackpotsRepository
     * @param {mongoose.Model} exchangeRatesRepository
     */
    constructor(gameId, famesRepository, jackpotsRepository, exchangeRatesRepository) {
        this.gameId = gameId;
        this.famesRepository = famesRepository;
        this.jackpotsRepository = jackpotsRepository;
        this.exchangeRatesRepository = exchangeRatesRepository;
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
            baseTotalAmount: true,
            winningAmount: true,
            baseWinningAmount: true,
            freeSpin: true,
            rate: true,
            exchangeRateId: true,
        };

        const winners =
            (await this.famesRepository
                .find({}, projection, { sort: { time: -1 }, skip: numberOfSkippedWinners, limit: pageSize })
                .lean()
                .exec()) ?? [];

        await this.updateExchangeRateCode(player, winners);

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
            exchangeRateId: true,
        };
        const jackpotWinners = await this.jackpotsRepository
            .find(filter, projection, { sort: { hitTime: -1 }, skip: numberOfSkippedWinners, limit: pageSize })
            .lean()
            .exec();

        const winners = jackpotWinners.map((jackpotWinner) => {
            const winningAmount = jackpotWinner.amount * jackpotWinner.winningRatio;

            return {
                time: jackpotWinner.hitTime,
                name: jackpotWinner.winnerName,
                bet: jackpotWinner.pool,
                winningAmount,
                exchangeRateId: jackpotWinner.exchangeRateId,
            };
        });

        await this.updateExchangeRateCode(player, winners);

        return { jackpotWinners: { winners, page, pageSize, total } };
    }

    async updateExchangeRateCode(player, winners) {
        const exchangeRates = await this.getExchangeRates(winners.map((w) => w.exchangeRateId));
        const { session } = player;

        for (const winner of winners) {
            winner.exchangeRateCode = {
                [session.currencyCode]: parseFloat(exchangeRates.find((er) => winner.exchangeRateId === er.exId)?.code[session.currencyCode]),
            };
        }
    }

    async getExchangeRates(exIds) {
        const filter = {
            exId: { $in: exIds },
        };
        const projection = {
            _id: false,
            exId: true,
            code: true,
        };

        return this.exchangeRatesRepository.find(filter, projection).lean().exec();
    }
}
