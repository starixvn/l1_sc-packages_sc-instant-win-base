import mongoose from "mongoose";

/**
 * JACKPOT SCHEMA - Progressive Jackpot Pool Data Model
 *
 * PURPOSE:
 * Defines the database structure for storing progressive jackpot pool data.
 * Tracks pool growth, winner information, and contribution statistics.
 *
 * SCHEMA OVERVIEW:
 * - **Pool Management**: Tracks current amounts, initial amounts, and growth
 * - **Winner Tracking**: Records who won, when, and prize details
 * - **Contribution Analytics**: Separates bot vs real player contributions
 * - **Multi-tier Support**: Handles Grand, Major, Minor jackpot pools
 *
 * KEY FIELDS:
 * - pool: Current jackpot amount (grows with contributions)
 * - prize: Pool tier ('grand', 'major', 'minor')
 * - winnerName/winnerId: Who won this pool
 * - byBots/byMembers: Contribution tracking for analytics
 */
const jackpotSchema = new mongoose.Schema({
    // GAME IDENTIFICATION
    gameId: { type: Number, required: true },          // Which game this pool belongs to
    gameName: { type: String, required: true },        // Game display name

    // POOL DATA
    prize: { type: String },                           // Pool tier: 'grand', 'major', 'minor'
    initAmount: { type: Number, required: true },      // Initial pool amount when created
    amount: { type: Number, default: 0 },              // Current pool amount (grows with bets)
    winningRatio: { type: Number },                    // Multiplier applied to final payout

    // WINNER INFORMATION (populated when pool is won)
    winnerName: { type: String },                      // Player's display name
    winnerId: { type: String },                        // Internal player ID

    // CONTRIBUTION TRACKING (for analytics)
    byBots: { type: Number, default: 0 },             // Amount contributed by automated players
    byMembers: { type: Number, default: 0 },          // Amount contributed by real players

    // TIMING INFORMATION
    createdAt: { type: Number, required: true },      // Round ID when pool was created
    hitAt: { type: Number },                           // Round ID when pool was won
    createdTime: { type: Date, required: true },      // Timestamp when pool was created
    hitTime: { type: Date },                           // Timestamp when pool was won

    // CURRENCY & OPERATOR INFO
    rate: { type: Number },                            // Exchange rate at time of win
    exchangeRateId: { type: Number },                  // Currency conversion reference
    operatorId: { type: String },                      // Casino operator identifier
    currency: { type: String },                        // Player's currency at time of win
});

export default mongoose.model("Jackpot", jackpotSchema);
