import { Core } from "sc-game-base";
import authenticationHelpers from "sc-game-base/src/core/helpers/authentication-helpers";

import SlotGameData from "./../slot-game-data";

export default class JackpotPublisher extends Core.BaseEventPublishers.BaseEventPublisher {
    /**
     * @param {Number} gameId
     * @param {String} gameName
     * @param {SlotGameData} gameData
     * @param {Object} appConfigs
     * @param {logger} logService
     */

    constructor(gameId, gameName, gameData, appConfigs, logService) {
        super(gameName, gameData);

        this.gameId = gameId;
        this.appConfigs = appConfigs;
        this.logService = logService;
    }

    publishLatestPool(pool) {
        this.publishToEligibleUsers({ jackpotPool: pool });
    }

    async publishWinner(playerId, winner) {
        this.publishToUser(playerId, { winningJackpot: winner });
        this.publishToEligibleUsers({ jackpotWinner: winner });

        await this.sendJackpotWinner(winner);
    }

    publishToEligibleUsers(payload) {
        const socketPlayers = Object.values(this.gameData.realPlayers)
            .filter((player) => !player.session.disableJackpotGames)
            .map((player) => player.socketClient);

        socketPlayers.forEach((socket) => {
            socket && socket.emit(this.gameName, payload);
        });
    }

    async sendJackpotWinner(winner) {
        try {
            const notificationServiceUrl = this.appConfigs.notificationServiceSettings.url;
            const params = {
                gameId: this.gameId,
                ...winner,
            };

            await authenticationHelpers.post(`${notificationServiceUrl}${"/jackpotWinner"}`, params);
        } catch (error) {
            this.logService.logError(error);
        }
    }

    publishFailedJackpot(playerId, error) {
        this.publishToUser(playerId, { jackpotError: error });
    }
}
