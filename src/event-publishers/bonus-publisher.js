import { Core } from "sc-game-base";

/**
 * BONUS PUBLISHER - Real-time Bonus Event Broadcasting
 *
 * PURPOSE:
 * Handles real-time communication of bonus-related events to players.
 * Publishes chest openings, progress updates, and award notifications via WebSocket.
 *
 * PUBLISHED EVENTS:
 * - **bonusChest**: Individual chest prize reveals during bonus mini-game
 * - **progressBonus**: Progress bonus updates and countdowns
 * - **progressBonusAward**: Progress bonus completion rewards
 *
 * REAL-TIME IMPORTANCE:
 * - Creates excitement with immediate prize reveals
 * - Provides visual feedback for chest-opening animations
 * - Maintains player engagement during interactive bonus phases
 */
export default class BonusPublisher extends Core.BaseEventPublishers.BaseEventPublisher {
    /**
     * PUBLISH BONUS CHEST OPENING
     *
     * Notifies player of prize amount when they open a bonus chest.
     * Triggers chest-opening animations and prize displays in the client.
     *
     * @param {string} playerId - Player's unique identifier
     * @param {Object} params - Chest opening details
     * @param {number} params.chest - Chest index (0-9) that was opened
     * @param {number} params.amount - Prize amount won from this chest
     */
    publishBonus(playerId, { chest, amount }) {
        this.publishToUser(playerId, { bonusChest: { chest, amount } });
    }

    /**
     * PUBLISH PROGRESS BONUS UPDATES
     *
     * Sends progress bonus status updates to player.
     * Used for countdown timers and progress tracking.
     *
     * @param {string} playerId - Player's unique identifier
     * @param {Object} bonusEvent - Progress bonus event data
     */
    publishProgressBonus(playerId, bonusEvent) {
        this.publishToUser(playerId, bonusEvent);
    }

    /**
     * PUBLISH PROGRESS BONUS AWARD
     *
     * Notifies player when they complete a progress bonus and receive rewards.
     *
     * @param {string} playerId - Player's unique identifier
     * @param {Object} awardEvent - Award event data with prize details
     */
    publishProgressBonusAward(playerId, awardEvent) {
        this.publishToUser(playerId, awardEvent);
    }
}
