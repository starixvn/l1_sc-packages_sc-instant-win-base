import mongoose from "mongoose";

/**
 * CURRENCY GROUP GAMES SCHEMA - Currency-Specific Game Configuration
 *
 * PURPOSE:
 * Defines game settings and betting limits for specific currency groups.
 * Allows different configurations based on player currency and regional requirements.
 *
 * BUSINESS VALUE:
 * - **Currency Flexibility**: Different bet limits for different currencies
 * - **Regional Compliance**: Meet varying regulatory requirements
 * - **Market Segmentation**: Different pricing strategies per market
 * - **Risk Management**: Currency-specific win limits and bet controls
 *
 * CONFIGURATION SCOPE:
 * - Applies to groups of players using the same currency
 * - Overrides default game settings for that currency group
 * - Ensures compliance with local gambling regulations
 *
 * KEY FEATURES:
 * - Bet level ranges (min/max per payline)
 * - Maximum win limits per round
 * - Currency-specific chip values
 * - Game enable/disable per currency
 */
const schema = new mongoose.Schema({
    // GROUP IDENTIFICATION
    groupId: { type: mongoose.Types.ObjectId, require: true },  // Currency group reference
    gameId: { type: Number, require: true },                    // Game identifier
    gameName: { type: String, require: true },                  // Game display name

    // GAME AVAILABILITY
    enabled: { type: Boolean, require: true },                  // Game enabled for this currency group

    // BETTING LIMITS (per payline, in base currency)
    minBet: { type: Number, require: true },                    // Minimum bet per payline
    maxBet: { type: Number, require: true },                    // Maximum bet per payline
    maxBetPerChoices: { type: Object, require: true },          // Max bet per choice type

    // CURRENCY VALUES
    chips: [Number],                                             // Available chip denominations
    coinValues: [Number],                                        // Coin value options

    // WIN LIMITS
    maxWinPerRound: Number,                                      // Maximum payout per round

    // BET LEVELS (in base currency)
    betLevels: [Number],                                         // Available bet amounts per payline
    defaultBetLevel: { type: Number },                           // Recommended default bet
});

/**
 * CURRENCY GROUP GAMES MODEL FACTORY
 *
 * Creates and returns the mongoose model for currency group games.
 * Uses a factory function to ensure fresh model creation and avoid conflicts.
 *
 * @returns {mongoose.Model} - Currency group games model
 */
export default function () {
    // Clean up any existing model to prevent conflicts
    mongoose.deleteModel("currency_group_games");
    return mongoose.model("currency_group_games", schema);
}
