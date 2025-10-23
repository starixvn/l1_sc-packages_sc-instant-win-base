import { Table } from "sc-game-base";

export default class UserSignInConsumer extends Table.EventConsumers.TableUserSignInConsumer {
    /**
     * @param {Object} dependencies
     * @param {TableGameDefinition} dependencies.definition
     * @param {TableGameData} dependencies.gameData
     * @param {TableUserSignInPublisher} dependencies.userSignInPublisher
     * @param {PlayGamePermissionValidator} dependencies.playGamePermissionValidator
     * @param {Object} dependencies.appConfigs
     * @param {GameManagementApiClientFactory} dependencies.gameManagementApiClientFactory
     * @param {Object} dependencies.logService
     * @param {PromotionClient} [dependencies.gamePromotionApiClient]
     */
    constructor({
        definition,
        gameData,
        userSignInPublisher,
        playGamePermissionValidator,
        appConfigs,
        gameManagementApiClientFactory,
        logService,
        gamePromotionApiClient,
    }) {
        super({
            definition,
            gameData,
            userSignInPublisher,
            playGamePermissionValidator,
            appConfigs,
            gameManagementApiClientFactory,
            logService,
            gamePromotionApiClient,
        });
    }

    handleSignInSuccess(socketClient, userInfo, userSession, promotionData = null) {
        super.handleSignInSuccess(socketClient, userInfo, userSession, promotionData);
        this.gameData.realPlayers[socketClient.id].profile.avatarId = userInfo.avatarId;
    }
}
