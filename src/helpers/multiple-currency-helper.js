export default {
    calculateRate(session, gameData) {
        return !!session ? session.multiplier * gameData.exchangeRates.code[session.currencyCode] : 1;
    },
    getStakeLevels(gameData, player) {
        const settings = gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);

        return settings?.stakeLevels ?? [];
    },
};
