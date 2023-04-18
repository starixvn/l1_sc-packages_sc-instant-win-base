import { PlayGamePermissionValidator } from "sc-game-base/src/core/validators";

export default class SlotGamePlayGamePermissionValidator extends PlayGamePermissionValidator {
    isHavePlayingPermission(userSession) {
        const { jackpot } = this.gameData.gameConfigs.slotsConfig;
        
        if (jackpot.enabled) {
            return (userSession.isTestCurrency || !userSession.disableJackpotGames) && super.isHavePlayingPermission(userSession);
        }
        
        return super.isHavePlayingPermission(userSession);
    }
}
