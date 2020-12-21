import mongoose from "mongoose";

const idCountersSchema = new mongoose.Schema({
    c: { type: Number, required: true, default: 0 },
    f: { type: String, required: true },
    m: { type: String, required: true },
});

export default mongoose.model("IdCounter", idCountersSchema);
