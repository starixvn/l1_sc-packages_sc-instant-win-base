import mongoose from "mongoose";

const schema = new mongoose.Schema({
    groupId: { type: mongoose.Types.ObjectId, require: true },
    gameId: { type: Number, require: true },
    gameName: { type: String, require: true },
    enabled: { type: Boolean, require: true },
    minBet: { type: Number, require: true },
    maxBet: { type: Number, require: true },
    maxBetPerChoices: { type: Object, require: true },
    chips: [Number],
    coinValues: [Number],
    maxWinPerRound: Number,
    betLevels: [Number],
    defaultBetLevel: { type: Number },
});

export default function () {
    mongoose.deleteModel("currency_group_games");
    return mongoose.model("currency_group_games", schema);
}
