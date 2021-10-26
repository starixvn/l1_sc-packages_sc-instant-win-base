export default {
    calculateRate(session, gameData) {
        return !!session ? session.multiplier * gameData.exchangeRates.code[session.currencyCode] : 1;
    },
};
