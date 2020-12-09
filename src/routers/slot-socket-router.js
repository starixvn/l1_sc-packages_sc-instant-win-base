import { Core } from "sc-game-base";

import HallOfFameQuery from "./../query-apis/hall-of-fame-query";

export default class SlotSocketRouter extends Core.Routers.BaseSocketRouter {
    constructor({
        definition,
        gameData,
        userSignInConsumer,
        userDisconnectConsumer,
        inGameConsumer,
        placeBetConsumer,
        userSignInPublisher,
        historyQuery,
        roundQuery,
        hallOfFameQuery,
    }) {
        super({
            definition,
            gameData,
            userSignInConsumer: userSignInConsumer ?? new UserSignInConsumer(definition, gameData),
            userDisconnectConsumer: userDisconnectConsumer ?? new OutGameConsumer(definition, gameData),
            inGameConsumer: inGameConsumer ?? new InGameConsumer({ definition, gameData, roundQuery }),
            placeBetConsumer,
            userSignInPublisher,
            historyQuery,
            roundQuery,
        });

        this.hallOfFameQuery = hallOfFameQuery ?? new HallOfFameQuery(definition);
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    init(socketClient) {
        super.init(socketClient);

        this.socketClient.on("getBigWinningWinners", this.handleGettingBigWinningWinners.bind(this));
        this.socketClient.on("getJackpotWinners", this.handleGettingJackpotWinners.bind(this));
    }

    async handleGettingBigWinningWinners(payload) {
        try {
            if (!this.verify()) {
                return;
            }

            const bigWinningWinners = await this.hallOfFameQuery.queryBigWinningWinners(payload.page ?? 0);

            this.socketClient.emit(this.definition.name, bigWinningWinners);
        } catch (error) {
            logger.logError(error);
        }
    }

    async handleGettingJackpotWinners(payload) {
        try {
            if (!this.verify()) {
                return;
            }

            const jackpotWinners = await this.hallOfFameQuery.queryJackpotWinners(payload.page ?? 0);

            this.socketClient.emit(this.definition.name, jackpotWinners);
        } catch (error) {
            logger.logError(error);
        }
    }
}
