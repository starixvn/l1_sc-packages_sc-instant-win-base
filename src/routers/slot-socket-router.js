import { logger } from "sc-common";
import { Core } from "sc-game-base";

import { BonusConsumer, InGameConsumer, PlaceBetConsumer } from "./../event-consumers";
import { HallOfFameQuery, SlotHistoryQuery } from "./../query-apis";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class SlotSocketRouter extends Core.Routers.BaseSocketRouter {
    /**
     * @param {Object} dependencies
     * @param {SlotGameDefinition} dependencies.definition
     * @param {SlotGameData} dependencies.gameData
     * @param {Core.BaseEventConsumers.UserSignInConsumer} dependencies.userSignInConsumer
     * @param {InGameConsumer} dependencies.inGameConsumer
     * @param {PlaceBetConsumer} dependencies.placeBetConsumer
     * @param {BonusConsumer} dependencies.bonusConsumer
     * @param {Core.BaseEventConsumers.UserDisconnectConsumer} dependencies.userDisconnectConsumer
     * @param {Core.BaseEventPublishers.UserSignInPublisher} dependencies.userSignInPublisher
     * @param {SlotHistoryQuery} dependencies.historyQuery
     * @param {HallOfFameQuery} dependencies.hallOfFameQuery
     * @param {logger} ldependencies.logService
     * @param {PlayGamePermissionValidator} dependencies.playGamePermissionValidator
     */
    constructor({
        definition,
        gameData,
        userSignInConsumer,
        inGameConsumer,
        placeBetConsumer,
        bonusConsumer,
        userDisconnectConsumer,
        userSignInPublisher,
        historyQuery,
        hallOfFameQuery,
        logService,
        playGamePermissionValidator,
    }) {
        super({
            definition,
            gameData,
            userSignInConsumer,
            inGameConsumer,
            placeBetConsumer,
            userDisconnectConsumer,
            userSignInPublisher,
            historyQuery,
            logService,
            playGamePermissionValidator,
        });

        this.bonusConsumer = bonusConsumer;
        this.hallOfFameQuery = hallOfFameQuery;
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
            if (!(await this.verify())) {
                return;
            }

            const bigWinningWinners = await this.hallOfFameQuery.queryBigWinningWinners(
                this.gameData.realPlayers[this.socketClient.id],
                payload.page ?? 0
            );

            this.socketClient.emit(this.definition.name, bigWinningWinners);
        } catch (error) {
            this.logService.logError(error);
        }
    }

    async handleGettingJackpotWinners(payload) {
        try {
            if (!(await this.verify())) {
                return;
            }

            const jackpotWinners = await this.hallOfFameQuery.queryJackpotWinners(this.gameData.realPlayers[this.socketClient.id], payload.page ?? 0);

            this.socketClient.emit(this.definition.name, jackpotWinners);
        } catch (error) {
            this.logService.logError(error);
        }
    }

    async handleBonus(payload) {
        try {
            if (!(await this.verify())) {
                return;
            }

            await this.bonusConsumer.consume(this.gameData.realPlayers[this.socketClient.id], payload);
        } catch (error) {
            this.logService.logError(error);
        }
    }

    async handleDisconnect() {
        try {
            await this.userDisconnectConsumer.consume(this.socketClient);
        } catch (error) {
            this.logService.logError(error);
        }
    }
}
