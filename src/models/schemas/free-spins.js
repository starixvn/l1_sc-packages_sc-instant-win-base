import mongoose from "mongoose";
import autoIncrement from "mongoose-auto-increment-reworked";

const freeSpinsSchema = new mongoose.Schema({
    uid: { type: String, required: true },
    memberId: { type: Number, required: true },
    name: { type: String, required: true },
    roundId: { type: Number, required: true },
    bet: { type: Number, required: true },
    paylines: { type: [Number], required: true },
    total: { type: Number, required: true },
    available: { type: Number, default: 0 },
    time: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
});

freeSpinsSchema.plugin(autoIncrement.MongooseAutoIncrementID.plugin, { modelName: "FreeSpin", field: "id" });

export default freeSpinsSchema;
