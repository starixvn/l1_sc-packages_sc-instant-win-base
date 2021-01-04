import { logger } from "sc-common";
import { Core } from "sc-game-base";

export default class JackpotPublisher extends Core.BaseEventPublishers.BasePublisher {
    constructor(gameId, gameName, gameData) {
        super(gameName, gameData);

        this.gameId = gameId;
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

            await Core.Helpers.authenticationHelper.post("jackpotWinner", params);
        } catch (error) {
            logger.logError(error);
        }
    }
}
