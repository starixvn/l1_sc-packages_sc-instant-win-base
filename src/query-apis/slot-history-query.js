import mongoose from "mongoose";

export default class SlotHistoryQuery {
    /**
     * @param {mongoose.Model} roundsRepository
     */
    constructor(roundsRepository) {
        this.roundsRepository = roundsRepository;
    }

    async queryHistory(player, page, pageSize) {
        if (page < 1 || !player) {
            return {};
        }

        const filter = { uid: player.UID, paid: true };
        const numberOfSkippedBets = (page - 1) * pageSize;
        const total = await this.roundsRepository.countDocuments(filter).exec();
        const roundProjection = {
            _id: false,
            roundId: "$id",
            name: true,
            uid: true,
            bet: true,
            totalAmount: true,
            baseTotalAmount: true,
            freeSpin: true,
            jackpotContribution: true,
            betwin: "$betWin",
            baseBetWin: true,
            time: true,
            endTime: true,
            currency: true,
            rate: true,
            exchangeRateId: true,
            operatorId: true,
            enableJackpot: { $cond: [{ $gt: ["$jackpotContribution.contributionRate", 0] }, true, false] },
        };

        const betLogs = await this.roundsRepository
            .find(filter, roundProjection, { sort: { _id: -1 }, skip: numberOfSkippedBets, limit: pageSize })
            .lean()
            .exec();

        return { history: { betLogs, page, pageSize, total } };
    }
}
