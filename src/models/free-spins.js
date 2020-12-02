import mongoose from "mongoose";

const freeSpinsSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    time: { type: Date, required: true },
    refId: { type: Number, required: true },
    uid: { type: String, required: true },
    memberId: { type: Number, required: true },
    name: { type: String, required: true },

    total: { type: Number, required: true },
    available: { type: Number, default: 0 },
});

export default mongoose.model("FreeSpin", freeSpinsSchema);
