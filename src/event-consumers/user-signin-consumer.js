import { Table } from "sc-game-base";

/**
 * USER SIGN IN CONSUMER - Player Authentication & Session Management
 *
 * PURPOSE:
 * Extends the base table game sign-in consumer with slot-specific user handling.
 * Manages player authentication, session initialization, and avatar assignment.
 *
 * SLOT-SPECIFIC FEATURES:
 * - Avatar ID assignment for player profiles
 * - Integration with slot game data structures
 * - Promotion data handling for special offers
 *
 * INHERITANCE:
 * Extends TableUserSignInConsumer which provides:
 * - Basic authentication validation
 * - Session creation and management
 * - Permission checking
 * - Promotion client integration
 * - WebSocket connection handling
 */
export default class UserSignInConsumer extends Table.EventConsumers.TableUserSignInConsumer {
    /**
     * @param {Object} dependencies - Slot game dependencies
     * @param {TableGameDefinition} dependencies.definition - Game configuration
     * @param {TableGameData} dependencies.gameData - Runtime game state
     * @param {TableUserSignInPublisher} dependencies.userSignInPublisher - Sign-in event publisher
     * @param {PlayGamePermissionValidator} dependencies.playGamePermissionValidator - Permission validator
     * @param {Object} dependencies.appConfigs - Application configuration
     * @param {GameManagementApiClientFactory} dependencies.gameManagementApiClientFactory - Game management API
     * @param {Object} dependencies.logService - Logging service
     * @param {PromotionClient} [dependencies.gamePromotionApiClient] - Optional promotion client
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

    /**
     * HANDLE SUCCESSFUL SIGN IN - Complete Player Setup
     *
     * Called when a player successfully authenticates and joins the game.
     * Performs base sign-in handling plus slot-specific avatar assignment.
     *
     * Avatar Assignment:
     * The avatar ID is stored in the player's profile for display in:
     * - Hall of fame leaderboards
     * - Win announcements
     * - Player lists and social features
     *
     * @param {Object} socketClient - Player's WebSocket connection
     * @param {Object} userInfo - User account information
     * @param {Object} userSession - Active session data
     * @param {Object} promotionData - Active promotions (optional)
     */
    handleSignInSuccess(socketClient, userInfo, userSession, promotionData = null) {
        // Call parent sign-in handler for base functionality
        super.handleSignInSuccess(socketClient, userInfo, userSession, promotionData);

        // SLOT-SPECIFIC: Store avatar ID in real-time player data
        // This ensures avatar shows up in win announcements and leaderboards
        this.gameData.realPlayers[socketClient.id].profile.avatarId = userInfo.avatarId;
    }
}
