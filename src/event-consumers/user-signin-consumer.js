import { Core } from "sc-game-base";

export default class UserSignInConsumer extends Core.BaseEventConsumers.UserSignInConsumer {
    constructor(gameData, userSignInPublisher, userInfosRepository, userSessionsRepository, playGamePermissionValidator, definition) {
        super(gameData, userSignInPublisher, userInfosRepository, userSessionsRepository, playGamePermissionValidator);
        this.definition = definition;
    }

    handleSignInSuccess(socketClient, userInfo, userSession) {
        const allowedCurrencies = this.gameData.gameConfigs.slotsConfig.jackpot.allowedCurrencies ?? "";
        const isAllowed =
            !this.gameData.gameConfigs.slotsConfig.jackpot.enabled ||
            (userSession.isTestCurrency && this.gameData.gameConfigs.slotsConfig.jackpot.isAllowedTestCurrencies) ||
            `;${allowedCurrencies.toUpperCase()};`.indexOf(`;${userSession.currency.toUpperCase()};`) !== -1;

        if (!isAllowed) {
            this.userSignInPublisher.publishNotPermittedToPlayMessage(socketClient, this.definition.id);
            return;
        }

        super.handleSignInSuccess(socketClient, userInfo, userSession);
    }
}
