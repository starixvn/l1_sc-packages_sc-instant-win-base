import { Core } from "sc-game-base";

import Jackpots from "./../models/jackpots";

export default class HallOfFameQuery {
    /**
     * @param {Core.GameDefinition} definition
     */
    constructor(definition) {
        this.definition = definition;
    }

    async queryBigWinningWinners(page, pageSize = 8) {
        if (page < 1 || pageSize < 1) {
            return;
        }

        const numberOfSkippedWinners = (page - 1) * pageSize;
        const total = await this.definition.famesRepository.countDocuments().exec();
        const projection = {
            _id: false,
            time: true,
            name: true,
            totalAmount: true,
            winningAmount: true,
        };
        const winners = await this.definition.famesRepository
            .find({}, projection, { sort: { time: -1 }, skip: numberOfSkippedWinners, limit: pageSize })
            .lean()
            .exec();

        return { bigWinningWinners: { winners, page, pageSize, total } };
    }

    async queryJackpotWinners() {
        if (page < 1 || pageSize < 1) {
            return;
        }

        const filter = {
            game: this.definition.name,
            winnerName: { $exists: true },
        };
        const numberOfSkippedWinners = (page - 1) * pageSize;
        const total = await Jackpots.countDocuments(filter).exec();
        const projection = {
            _id: false,
            hitTime: true,
            winnerName: true,
            pool: true,
            amount: true,
            winningRatio: true,
        };
        const jackpotWinners = await Fames.find(filter, projection, { sort: { hitTime: -1 }, skip: numberOfSkippedWinners, limit: pageSize })
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
}
