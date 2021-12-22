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
            winningAmount: true,
            freeSpin: true,
            rate: true,
            exchangeRateId: true,
        };

        const rawWinners =
            (await this.famesRepository
                .find({}, projection, { sort: { time: -1 }, skip: numberOfSkippedWinners, limit: pageSize })
                .lean()
                .exec()) ?? [];

        const playerSession = player.session;
        const winners = [];
        for (let i = 0; i < rawWinners.length; i++) {
            const rw = rawWinners[i];
            const viewerRate = !!rw.exchangeRateId ? await this.getViewerRate(playerSession, rw) : playerSession.multiplier;
            winners[i] = { ...rw, viewerRate };
        }

        return { bigWinningWinners: { winners, page, pageSize, total } };
    }

    async queryJackpotWinners(page, pageSize = 10) {
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

        const winners = jackpotWinners.map((jackpotWinner) => {
            const winningAmount = jackpotWinner.amount * jackpotWinner.winningRatio;

            return {
                time: jackpotWinner.hitTime,
                name: jackpotWinner.winnerName,
                bet: jackpotWinner.pool,
                winningAmount,
            };
        });

        return { jackpotWinners: { winners, page, pageSize, total } };
    }

    async getViewerRate(playerSession, winner) {
        const exchangeRates = await this.exchangeRatesRepository.findOne({ exId: winner.exchangeRateId }).lean().exec();

        return playerSession.multiplier * exchangeRates.code[playerSession.currency];
    }
}
