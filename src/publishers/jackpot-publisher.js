import { Core } from "sc-game-base";

export default class JackpotPublisher extends Core.BaseEventPublishers.BasePublisher {
    publishLatestPool(pool) {
        this.publishToAllUsers({ jackpotPool: pool });

        // TODO: need to send back to game lobby or not?
    }

    publishWinner(playerId, winner) {
        this.publishToUser(playerId, { winningJackpot: winner });
        this.publishToAllUsers({ jackpotWinner: winner });

        // TODO: need to send the winner to game lobby or not?
    }
}
