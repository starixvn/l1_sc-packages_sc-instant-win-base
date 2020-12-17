import { logger } from "sc-common";
import { Core } from "sc-game-base";

export default class JackpotPublisher extends Core.BaseEventPublishers.BasePublisher {
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
                gameName: this.gameName,
                ...winner,
            };
            Core.Helpers.authenticationHelper.post("jackpotWinner", params);
        } catch (error) {
            logger.logError(error);
        }
    }
}
