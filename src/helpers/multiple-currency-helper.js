export default {
    getStakeLevels(gameData, player) {
        const settings = gameData.currencyGroupGames.find((x) => x.groupId.toString() === player.session.currencyGroupId);

        return settings?.stakeLevels ?? [];
    },
};
