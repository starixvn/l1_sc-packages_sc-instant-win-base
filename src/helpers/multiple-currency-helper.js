import mongoose from "mongoose";

export default {
    calculateRate(session, gameData) {
        return !!session ? session.multiplier * gameData.exchangeRates.code[session.currencyCode] : 1;
    },
    getStakeLevels(gameData, player) {
        return gameData.stakeLevels.find((s) => s.groupId.toString() === player.session.currencyGroupId)?.stakeLevels ?? [];
    },
};
