import mongoose from "mongoose";

export default new mongoose.Schema({
    uid: { type: String, required: true },
    memberId: { type: Number },
    name: { type: String, required: true },
    roundId: { type: Number, required: true },
    bet: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    winningAmount: { type: Number, required: true },
    numberOfPaylines: { type: Number, required: true },
    time: { type: Date },
});
