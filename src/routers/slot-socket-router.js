import { logger } from "sc-common";
import { Core } from "sc-game-base";

import { BonusConsumer, OutGameConsumer, PlaceBetConsumer } from "./../event-consumers";
import { HallOfFameQuery, SlotHistoryQuery } from "./../query-apis";

export default class SlotSocketRouter extends Core.Routers.BaseSocketRouter {
    constructor({
        definition,
        gameData,
        userSignInConsumer,
        userDisconnectConsumer,
        inGameConsumer,
        placeBetConsumer,
        bonusConsumer,
        userSignInPublisher,
        historyQuery,
        roundQuery,
        hallOfFameQuery,
    }) {
        super({
            definition,
            gameData,
            userSignInConsumer,
            userDisconnectConsumer: userDisconnectConsumer ?? new OutGameConsumer(definition, gameData),
            inGameConsumer,
            placeBetConsumer: placeBetConsumer ?? new PlaceBetConsumer(definition, gameData),
            userSignInPublisher,
            historyQuery: historyQuery ?? new SlotHistoryQuery(definition),
            roundQuery,
        });

        this.bonusConsumer = bonusConsumer ?? new BonusConsumer(definition, gameData);
        this.hallOfFameQuery = hallOfFameQuery ?? new HallOfFameQuery(definition);
    }

    /**
     * @param {SocketIO.Socket} socketClient
     */
    init(socketClient) {
        super.init(socketClient);

        this.socketClient.on("getBigWinningWinners", this.handleGettingBigWinningWinners.bind(this));
        this.socketClient.on("getJackpotWinners", this.handleGettingJackpotWinners.bind(this));
        this.socketClient.on("bonus", this.handleBonus.bind(this));
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

    async handleBonus(payload) {
        try {
            if (!this.verify()) {
                return;
            }

            this.bonusConsumer.consume(this.gameData.realPlayers[this.socketClient.id], payload);
        } catch (error) {
            logger.logError(error);
        }
    }
}
