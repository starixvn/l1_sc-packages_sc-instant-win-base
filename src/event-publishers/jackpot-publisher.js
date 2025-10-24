import { Core } from "sc-game-base";
import authenticationHelpers from "sc-game-base/src/core/helpers/authentication-helpers";

import SlotGameData from "./../slot-game-data";

/**
 * JACKPOT PUBLISHER - Progressive Jackpot Event Broadcasting
 *
 * PURPOSE:
 * Manages real-time communication of jackpot-related events to players.
 * Broadcasts pool updates, winner announcements, and jackpot notifications.
 *
 * KEY RESPONSIBILITIES:
 * 1. **Pool Updates**: Broadcast current jackpot amounts to eligible players
 * 2. **Winner Announcements**: Notify all players when someone wins a jackpot
 * 3. **Personal Notifications**: Send private win confirmations to winners
 * 4. **External Notifications**: Forward jackpot wins to external systems
 *
 * ELIGIBILITY FILTERING:
 * Only broadcasts to players who haven't disabled jackpot games in their settings.
 * Respects player preferences for jackpot-related notifications.
 */
export default class JackpotPublisher extends Core.BaseEventPublishers.BaseEventPublisher {
    /**
     * @param {Number} gameId
     * @param {String} gameName
     * @param {SlotGameData} gameData
     * @param {Object} appConfigs
     * @param {logger} logService
     */

    /**
     * @param {number} gameId - Unique identifier for this game
     * @param {string} gameName - Game name for event routing
     * @param {SlotGameData} gameData - Runtime game state
     * @param {Object} appConfigs - Application configuration
     * @param {Object} logService - Logging service
     */
    constructor(gameId, gameName, gameData, appConfigs, logService) {
        super(gameName, gameData);

        this.gameId = gameId;
        this.appConfigs = appConfigs;
        this.logService = logService;
    }

    /**
     * BROADCAST POOL UPDATE - Real-time Jackpot Amounts
     *
     * Publishes current jackpot pool amounts to all eligible players.
     * Updates the live jackpot displays shown to players.
     *
     * @param {Object} pool - Pool update data { pool: 'grand', amount: 50000 }
     */
    publishLatestPool(pool) {
        this.publishToEligibleUsers({ jackpotPool: pool });
    }

    /**
     * ANNOUNCE JACKPOT WINNER - Multi-channel Notification
     *
     * Handles the complete winner announcement process:
     * 1. Sends private confirmation to the winner
     * 2. Broadcasts winner announcement to all eligible players
     * 3. Forwards win data to external notification systems
     *
     * This creates maximum excitement and social proof for jackpot wins.
     *
     * @param {string} playerId - Winner's player ID
     * @param {Object} winner - Winner details and prize information
     */
    async publishWinner(playerId, winner) {
        // Private confirmation to winner
        this.publishToUser(playerId, { winningJackpot: winner });

        // Public announcement to all players
        this.publishToEligibleUsers({ jackpotWinner: winner });

        // Forward to external notification system
        await this.sendJackpotWinner(winner);
    }

    /**
     * FILTERED BROADCAST - Send to Eligible Players Only
     *
     * Publishes events only to players who haven't disabled jackpot notifications.
     * Respects player privacy preferences for jackpot-related content.
     *
     * Filtering Logic:
     * - Gets all connected real players
     * - Filters out players who have disabled jackpot games
     * - Sends to remaining players' WebSocket connections
     *
     * @param {Object} payload - Event data to broadcast
     */
    publishToEligibleUsers(payload) {
        // Get all connected players who haven't disabled jackpot games
        const socketPlayers = Object.values(this.gameData.realPlayers)
            .filter((player) => !player.session.disableJackpotGames)  // Respect player preferences
            .map((player) => player.socketClient);  // Get their socket connections

        // Broadcast to all eligible players
        socketPlayers.forEach((socket) => {
            socket && socket.emit(this.gameName, payload);
        });
    }

    /**
     * EXTERNAL NOTIFICATION - Forward to Notification Service
     *
     * Sends jackpot win data to external notification systems.
     * This enables cross-platform notifications, analytics, and compliance reporting.
     *
     * Use Cases:
     * - Push notifications to mobile apps
     * - Email notifications for large wins
     * - Regulatory reporting requirements
     * - Analytics and business intelligence
     *
     * @param {Object} winner - Complete winner information
     */
    async sendJackpotWinner(winner) {
        try {
            // Get external notification service endpoint
            const notificationServiceUrl = this.appConfigs.notificationServiceSettings.url;

            // Prepare payload with game context
            const params = {
                gameId: this.gameId,  // Identify which game this win came from
                ...winner,            // Include all winner details
            };

            // Send to external notification service
            await authenticationHelpers.post(`${notificationServiceUrl}/jackpotWinner`, params);
        } catch (error) {
            // Log errors but don't fail the jackpot process
            this.logService.logError(error);
        }
    }

    /**
     * ERROR NOTIFICATION - Jackpot Processing Failures
     *
     * Notifies players when jackpot processing encounters errors.
     * Provides transparency when technical issues prevent jackpot payouts.
     *
     * @param {string} playerId - Player who encountered the error
     * @param {string} error - Error message to display
     */
    publishFailedJackpot(playerId, error) {
        this.publishToUser(playerId, { jackpotError: error });
    }
}
