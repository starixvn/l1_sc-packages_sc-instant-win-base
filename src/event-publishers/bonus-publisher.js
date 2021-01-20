import { Core } from "sc-game-base";

export default class BonusPublisher extends Core.BaseEventPublishers.BaseEventPublisher {
    publishBonus(playerId, { chest, amount }) {
        this.publishToUser(playerId, { bonusChest: { chest, amount } });
    }
}
