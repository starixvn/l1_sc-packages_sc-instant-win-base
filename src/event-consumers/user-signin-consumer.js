import { Table } from "sc-game-base";

export default class UserSignInConsumer extends Table.EventConsumers.TableUserSignInConsumer {
    handleSignInSuccess(socketClient, userInfo, userSession) {
        super.handleSignInSuccess(socketClient, userInfo, userSession);
        this.gameData.realPlayers[socketClient.id].profile.avatarId = userInfo.avatarId;
    }
}
