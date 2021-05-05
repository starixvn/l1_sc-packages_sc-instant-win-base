import mongoose from "mongoose";

const modelName = "IdCounter";

const idCountersSchema = new mongoose.Schema({
    c: { type: Number, required: true, default: 0 },
    f: { type: String, required: true },
    m: { type: String, required: true },
});

export default mongoose.model(modelName, idCountersSchema);
