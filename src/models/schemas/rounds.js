import mongoose from "mongoose";

/**
 * ROUNDS SCHEMA - Complete Game Round Record
 *
 * PURPOSE:
 * Stores comprehensive data for each completed game round including:
 * - Player and bet information
 * - Game results and settlement details
 * - Feature triggers (bonus, free spins, jackpot)
 * - Financial data and currency conversions
 *
 * BUSINESS VALUE:
 * - **Audit Trail**: Complete record of every game round for compliance
 * - **Analytics**: Data for player behavior and game performance analysis
 * - **Dispute Resolution**: Evidence for player disputes and investigations
 * - **Financial Reporting**: Accurate transaction records for accounting
 *
 * DATA RETENTION:
 * - Permanent storage for regulatory compliance
 * - Used for player history, statistics, and leaderboards
 * - Critical for financial reconciliation and fraud prevention
 *
 * SUB-SCHEMAS:
 * - winningLineSchema: Individual payline win details
 * - bonusSchema: Bonus game trigger information
 * - freeSpinsSchema: Free spins award details
 * - jackpotSchema: Jackpot win information
 * - settlementResultSchema: Complete round outcome
 * - bonusChestSchema: Interactive bonus prizes
 * - jackpotContributionSchema: Progressive pool contributions
 */

// SUB-SCHEMAS FOR ROUND COMPONENTS

/** WINNING LINE SCHEMA - Individual Payline Win Details */
const winningLineSchema = new mongoose.Schema(
    {
        payline: { type: Number, required: true },   // Payline index (0-24)
        symbol: { type: String, required: true },    // Winning symbol (0-10)
        count: { type: Number, required: true },     // Symbols in winning sequence (3-5)
        odds: { type: Number, required: true },      // Payout multiplier for this win
    },
    { _id: false }  // No separate ID for embedded sub-documents
);

/** BONUS SCHEMA - Bonus Game Trigger Information */
const bonusSchema = new mongoose.Schema(
    {
        count: { type: Number, required: true },     // Columns that triggered bonus (1-3)
        odds: { type: Number, required: true },      // Number of bonus chests generated
    },
    { _id: false }
);

/** FREE SPINS SCHEMA - Free Spins Award Details */
const freeSpinsSchema = new mongoose.Schema(
    {
        count: { type: Number, required: true },     // Columns that triggered free spins (1-3)
        odds: { type: Number, required: true },      // Number of free spins awarded
    },
    { _id: false }
);

/** JACKPOT SCHEMA - Progressive Jackpot Win Information */
const jackpotSchema = new mongoose.Schema(
    {
        winningLine: { type: Number, required: true }, // Payline that triggered jackpot
        winningAmount: { type: Number, required: true }, // Final jackpot payout amount
        winningPrize: { type: String },               // Prize tier selected (grand/major/minor)
        prizes: { type: [String] },                   // Available prize options on wheel
        picked: { type: Boolean, default: false },    // Whether player selected prize
    },
    { _id: false }
);

const settlementResultSchema = new mongoose.Schema(
    {
        winningPaylines: [winningLineSchema],
        bonus: bonusSchema,
        freeSpins: freeSpinsSchema,
        jackpot: jackpotSchema,
    },
    { _id: false }
);

const bonusChestSchema = new mongoose.Schema(
    {
        amount: { type: Number, required: true },
        picked: { type: Boolean, default: false },
    },
    { _id: false }
);

const jackpotContributionSchema = new mongoose.Schema(
    {
        contributionRate: { type: Number, default: 0 },
        baseContributionAmount: { type: Number, default: 0 },
    },
    { _id: false }
);

/**
 * MAIN ROUNDS SCHEMA - Complete Game Round Record
 *
 * Comprehensive record of every game round played, used for:
 * - Financial reconciliation and auditing
 * - Player history and statistics
 * - Regulatory compliance reporting
 * - Analytics and business intelligence
 * - Dispute resolution
 *
 * DATA INTEGRITY:
 * - All financial amounts stored in both display and base currencies
 * - Complete audit trail from bet placement to final settlement
 * - Links to all related entities (players, operators, sites)
 */
export default new mongoose.Schema({
    // ROUND IDENTIFICATION
    id: { type: Number, required: true },           // Unique round ID
    name: { type: String, required: true },         // Player display name
    siteId: { type: String },                        // Casino site identifier
    uid: { type: String },                           // Player user ID

    // BET INFORMATION
    bet: { type: Number, default: 0 },               // Bet amount per payline
    totalAmount: { type: Number, default: 0 },       // Total bet (display currency)
    baseTotalAmount: { type: Number, default: 0 },   // Total bet (base currency)
    paylines: { type: [Number] },                     // Active payline indices
    freeSpin: { type: Boolean, default: false },      // Whether this was a free spin

    // GAME RESULTS
    result: { type: [Number] },                       // Final board symbols (15 positions)
    settlementResult: { type: settlementResultSchema }, // Complete win breakdown
    bonusChests: { type: [bonusChestSchema] },        // Interactive bonus prizes
    jackpotContribution: { type: jackpotContributionSchema }, // Pool contributions

    // PAYOUT INFORMATION
    odds: { type: Object },                           // Payout table used for this round
    betWin: { type: Number, default: 0 },             // Total win (display currency)
    baseBetWin: { type: Number, default: 0 },         // Total win (base currency)

    // SETTLEMENT STATUS
    paid: { type: Boolean, default: false },          // Whether payout was processed
    time: { type: Date },                              // Round start time
    endTime: { type: Date },                          // Round completion time

    // CURRENCY & EXCHANGE INFORMATION
    currency: { type: String, required: true },       // Player's display currency
    rate: { type: Number, required: true },           // Exchange rate at time of play
    exchangeRateId: { type: Number, required: true }, // Currency conversion reference

    // OPERATOR & PLAYER LINKS
    operatorId: { type: String, required: true },     // Casino operator identifier
    playerId: { type: String, required: true },       // Internal player identifier
});
