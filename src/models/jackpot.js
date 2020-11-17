import mongoose from "mongoose";

const jackpotSchema = new mongoose.Schema({
    game: { type: String, required: true },
    pool: { type: Number, required: true }, // pool associated with each bet amount, such as 100, 100, etc.
    amount: { type: Number, default: 0 },

    winnerName: { type: String },
    winnerId: { type: Number },

    byBots: { type: Number, default: 0 },
    byMembers: { type: Number, default: 0 },

    createdAt: { type: Number }, // ticket's _id from which the jackpot pool was created.
    hitAt: { type: Number }, // ticket's _id from which the jackpot pool was hit.
});

export default mongoose.model("Jackpot", jackpotSchema);
