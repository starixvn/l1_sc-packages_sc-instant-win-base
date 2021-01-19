import { logger } from "sc-common";
import { Core } from "sc-game-base";

import SlotGameData from "./../slot-game-data";

export default class JackpotPublisher extends Core.BaseEventPublishers.BasePublisher {
    /**
     * @param {Number} gameId
     * @param {String} gameName
     * @param {SlotGameData} gameData
     * @param {Core.Helpers.authenticationHelpers} mainServiceCommunicator
     * @param {logger} logService
     */

    constructor(gameId, gameName, gameData, mainServiceCommunicator, logService) {
        super(gameName, gameData);

        this.gameId = gameId;
        this.mainServiceCommunicator = mainServiceCommunicator;
        this.logService = logService;
    }

    publishLatestPool(pool) {
        this.publishToAllUsers({ jackpotPool: pool });
    }

    async publishWinner(playerId, winner) {
        this.publishToUser(playerId, { winningJackpot: winner });
        this.publishToAllUsers({ jackpotWinner: winner });

        await this.sendJackpotWinner(winner);
    }

    async sendJackpotWinner(winner) {
        try {
            const params = {
                gameId: this.gameId,
                ...winner,
            };

            await this.mainServiceCommunicator.post("jackpotWinner", params);
        } catch (error) {
            this.logService.logError(error);
        }
    }

    publishFailedJackpot(playerId, error) {
        this.publishToUser(playerId, { jackpotError: error });
    }
}
