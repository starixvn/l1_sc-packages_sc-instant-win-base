import mongoose from "mongoose";
import GameData from "sc-game-base/src/core/game-data";

/**
 * HALL OF FAME CONSUMER - Big Win Tracking & Leaderboards
 *
 * PURPOSE:
 * Records significant wins for display in hall of fame leaderboards.
 * Tracks both monetary wins and notable achievements for social features.
 *
 * BUSINESS VALUE:
 * - **Social Proof**: Shows other players that big wins are possible
 * - **Engagement**: Encourages continued play through aspiration
 * - **Community**: Creates shared experiences and bragging rights
 * - **Analytics**: Tracks big win patterns and player behavior
 *
 * RECORDING CRITERIA:
 * - All wins above certain thresholds
 * - Special achievements (jackpots, bonuses)
 * - Free spin wins
 * - Multi-payline wins
 */
export default class HallOfFameConsumer {
    /**
     * @param {mongoose.Model} famesRepository - Database model for hall of fame records
     * @param {GameData} gameData - Runtime game state for exchange rates
     */
    constructor(famesRepository, gameData) {
        this.famesRepository = famesRepository;
        this.gameData = gameData;
    }

    /**
     * RECORD HALL OF FAME ENTRY - Log Notable Win
     *
     * Saves a player's win to the hall of fame database for leaderboard display.
     * Includes comprehensive win data for filtering and ranking.
     *
     * Data Captured:
     * - Player identification and session info
     * - Bet amounts in both display and base currencies
     * - Win amounts in both display and base currencies
     * - Game context (paylines, free spin status)
     * - Timing and exchange rate information
     *
     * Privacy Note: Only real player sessions get operator/currency data.
     * Bot wins are recorded but without sensitive session information.
     *
     * @param {Object} player - Player session data
     * @param {Object} winData - Complete win information
     * @param {number} winData.roundId - Game round identifier
     * @param {number} winData.bet - Bet amount per payline
     * @param {number} winData.totalAmount - Total bet amount
     * @param {number} winData.baseTotalAmount - Bet in base currency
     * @param {number} winData.winningAmount - Win amount
     * @param {number} winData.baseWinningAmount - Win in base currency
     * @param {number} winData.numberOfPaylines - Paylines played
     * @param {boolean} winData.freeSpin - Whether this was a free spin
     * @param {number} winData.rate - Currency exchange rate
     */
    async add(player, { roundId, bet, totalAmount, baseTotalAmount, winningAmount, baseWinningAmount, numberOfPaylines, freeSpin = false, rate }) {
        // Build hall of fame record with all win details
        const fame = {
            uid: player.UID,
            name: player.profile.name,
            roundId,
            bet,                    // Bet per payline
            totalAmount,           // Total bet amount
            baseTotalAmount,       // Bet in base currency
            winningAmount,         // Win amount
            baseWinningAmount,     // Win in base currency
            numberOfPaylines,      // Paylines played
            freeSpin,             // Free spin indicator
            time: new Date(),      // When the win occurred
            exchangeRateId: this.gameData.exchangeRates.exId,
            rate,                  // Exchange rate at time of win
        };

        // Add session-specific data only for real players (privacy protection)
        if (!!player.session) {
            fame.currency = player.session.currencyName;
            fame.operatorId = player.session.operatorId;
            fame.playerId = player.session.playerId;
        }

        // Save to hall of fame database
        await this.famesRepository.create(fame);
    }
}
