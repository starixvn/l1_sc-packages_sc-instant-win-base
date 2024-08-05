export default {
    getBetLevels(gameData, player) {
        const settings = gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);

        return settings?.betLevels ?? [];
    },

    getDefaultBetLevel(gameData, player) {
        const settings = gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);

        return settings?.defaultBetLevel;
    },
};
