import mongoose from "mongoose";

const jackpotSchema = new mongoose.Schema({
    gameId: { type: Number, required: true },
    gameName: { type: String, required: true },
    pool: { type: Number, required: true }, // pool associated with each bet amount, such as 100, 100, etc.
    initAmount: { type: Number, required: true },
    amount: { type: Number, default: 0 },
    winningRatio: { type: Number },

    winnerName: { type: String },
    winnerId: { type: Number },

    byBots: { type: Number, default: 0 },
    byMembers: { type: Number, default: 0 },

    createdAt: { type: Number, required: true }, // ticket's ID from which the jackpot pool was created.
    hitAt: { type: Number }, // ticket's ID from which the jackpot pool was hit.

    createdTime: { type: Date, required: true },
    hitTime: { type: Date },

    rate: { type: Number },
    exchangeRateId: { type: Number },
    operatorId: { type: String },
    currency: { type: String },
});

export default mongoose.model("Jackpot", jackpotSchema);
