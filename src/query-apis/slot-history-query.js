import SlotGameDefinition from "./../slot-game-definition";

export default class HistoryQuery {
    /**
     * @param {SlotGameDefinition} definition
     */
    constructor(definition) {
        this.definition = definition;
    }

    async queryHistory(player, page, pageSize = 8) {
        if (page < 1 || !player) {
            return {};
        }

        const filter = { uid: player.UID, thanhtoan: true };
        const numberOfSkippedBets = (page - 1) * pageSize;
        const total = await this.definition.roundRepository.countDocuments(filter).exec();
        const roundProjection = {
            _id: false,
            thanhtoan: false,
            odds: false,
            siteId: false,
            memberId: false,
            bonusChests: false,
            __v: false,
            __archive: false,
        };
        const betLogs = await this.definition.roundRepository
            .find(filter, roundProjection, { sort: { _id: -1 }, skip: numberOfSkippedBets, limit: pageSize })
            .lean()
            .exec();

        return { history: { betLogs, page, pageSize, total } };
    }
}
