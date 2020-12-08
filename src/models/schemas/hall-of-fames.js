import mongoose from "mongoose";

const fameSchema = new mongoose.Schema({
    uid: { type: String, required: true },
    memberId: { type: Number, required: true },
    name: { type: String, required: true },
    roundId: { type: Number, required: true },
    bet: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    numberOfPaylines: { type: Number, required: true },
    time: { type: Date },
});

export default mongoose.model("Fame", fameSchema);
