import mongoose from "mongoose";

export default {
    calculateRate(session, gameData) {
        return !!session ? session.multiplier * gameData.exchangeRates.code[session.currencyCode] : 1;
    },
    async getStakeLevels(currencyGroupGamesRepository, definition, player) {
        const { session } = player;
        const setting = await currencyGroupGamesRepository
            .findOne({ groupId: mongoose.Types.ObjectId(session.currencyGroupId), gameId: definition.id }, "stakeLevels")
            .lean()
            .exec();

        return !!setting ? setting.stakeLevels : [];
    },
};
