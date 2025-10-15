import mongoose from "mongoose";

const progressBonusSchema = new mongoose.Schema({
    playerId: { type: String, required: true },
    operatorId: { type: String, required: true },
    uid: { type: String, required: true },
    name: { type: String, required: true },
    currency: { type: String, required: true },

    totalBetAmount: { type: Number, default: 0 },
    lastBonusRoundId: { type: Number, default: null },

    lastTapTime: { type: Date, default: null },
    isDecreasing: { type: Boolean, default: false },
    decreaseStartTime: { type: Date, default: null },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

export default progressBonusSchema;
