import { Table } from "sc-game-base";

export default class UserSignInConsumer extends Table.EventConsumers.TableUserSignInConsumer {
    handleSignInSuccess(socketClient, userInfo, userSession) {
        const allowedCurrency = this.gameData.gameConfigs.slotsConfig.jackpot.allowedCurrency ?? "";
        const isAllowed =
            !this.gameData.gameConfigs.slotsConfig.jackpot.enabled ||
            userSession.isTestCurrency ||
            allowedCurrency.toUpperCase() === userSession.currencyName.toUpperCase();

        if (!isAllowed) {
            this.userSignInPublisher.publishNotPermittedToPlayMessage(socketClient, this.definition.id);
            return;
        }

        super.handleSignInSuccess(socketClient, userInfo, userSession);
    }
}
