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

export default new mongoose.Schema({
    id: { type: Number, required: true },
    name: { type: String, required: true },
    memberId: { type: Number },
    siteId: { type: String },
    uid: { type: String },

    bet: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    paylines: { type: [Number] },
    freeSpin: { type: Boolean, default: false },

    result: { type: [Number] },
    settlementResult: { type: settlementResultSchema },
    bonusChests: { type: [bonusChestSchema] },

    odds: { type: Object },
    betWin: { type: Number, default: 0 },
    jackpotWin: { type: Number },
    paid: { type: Boolean, default: false },
    time: { type: Date },
    endTime: { type: Date },

    partnerId: { type: String, require: true },
    currency: { type: String, require: true },
    rate: { type: Number, require: true },
    exchangeRateId: { type: Number, require: true },
    operatorId: { type: String, require: true },
    playerId: { type: Number },
});
