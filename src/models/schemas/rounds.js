import mongoose from "mongoose";

const winningLineSchema = new mongoose.Schema(
    {
        payline: { type: Number, required: true },
        symbol: { type: String, required: true },
        count: { type: Number, required: true },
        odds: { type: Number, required: true },
    },
    { _id: false }
);

const bonusSchema = new mongoose.Schema(
    {
        count: { type: Number, required: true },
        odds: { type: Number, required: true },
    },
    { _id: false }
);

const freeSpinsSchema = new mongoose.Schema(
    {
        count: { type: Number, required: true },
        odds: { type: Number, required: true },
    },
    { _id: false }
);

const jackpotSchema = new mongoose.Schema(
    {
        winningLine: { type: Number, required: true },
        winningAmount: { type: Number, required: true },
        winningPrize: { type: String },
        prizes: { type: [String] },
        picked: { type: Boolean, default: false },
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

export default new mongoose.Schema({
    id: { type: Number, required: true },
    name: { type: String, required: true },
    siteId: { type: String },
    uid: { type: String },

    bet: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    baseTotalAmount: { type: Number, default: 0 },
    paylines: { type: [Number] },
    freeSpin: { type: Boolean, default: false },

    result: { type: [Number] },
    settlementResult: { type: settlementResultSchema },
    bonusChests: { type: [bonusChestSchema] },
    jackpotContribution: { type: jackpotContributionSchema },

    odds: { type: Object },
    betWin: { type: Number, default: 0 },
    baseBetWin: { type: Number, default: 0 },
    jackpotWin: { type: Number },
    paid: { type: Boolean, default: false },
    time: { type: Date },
    endTime: { type: Date },

    currency: { type: String, required: true },
    rate: { type: Number, required: true },
    exchangeRateId: { type: Number, required: true },

    operatorId: { type: String, required: true },
    playerId: { type: String, required: true },
});
