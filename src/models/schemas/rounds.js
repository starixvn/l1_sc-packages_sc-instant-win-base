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

const settlementResultSchema = new mongoose.Schema(
    {
        paylines: [winningLineSchema],
        bonus: bonusSchema,
        freeSpins: freeSpinsSchema,
        jackpot: { type: Boolean },
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
    name: { type: String, required: true },
    memberId: { type: Number },
    siteId: { type: String },

    bet: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    paylines: { type: [Number] },

    results: { type: [Number] },
    settlementResult: { type: settlementResultSchema },
    bonusChests: { type: [bonusChestSchema] },

    odds: { type: Object },
    betwin: { type: Number, default: 0 },
    thanhtoan: { type: Boolean, default: false },
    time: { type: Date },
});
