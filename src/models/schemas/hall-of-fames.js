import mongoose from "mongoose";

export default new mongoose.Schema({
    uid: { type: String, required: true },
    name: { type: String, required: true },
    roundId: { type: Number, required: true },
    bet: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    baseTotalAmount: { type: Number, required: true },
    winningAmount: { type: Number, required: true },
    baseWinningAmount: { type: Number, required: true },
    numberOfPaylines: { type: Number, required: true },
    freeSpin: { type: Boolean, default: false },
    time: { type: Date },
    currency: { type: String, required: false },
    rate: { type: Number, required: false },
    exchangeRateId: { type: Number, required: false },

    operatorId: { type: String, required: false },
    playerId: { type: String },
});
