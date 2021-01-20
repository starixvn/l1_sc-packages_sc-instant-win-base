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
            paid: false,
            odds: false,
            siteId: false,
            memberId: false,
            __v: false,
            __archive: false,
        };
        const rawBetLogs = await this.roundsRepository
            .find(filter, roundProjection, { sort: { _id: -1 }, skip: numberOfSkippedBets, limit: pageSize })
            .lean()
            .exec();
        const betLogs = rawBetLogs.map((rawBetLog) => {
            const betLog = { ...rawBetLog };

            delete betLog.bonusChests;

            betLog.settlementResult.bonus.winningAmount = rawBetLog.bonusChests.reduce(
                (winningAmount, bonusChest) => winningAmount + bonusChest.amount,
                0
            );

            return betLog;
        });

        return { history: { betLogs, page, pageSize, total } };
    }
}
