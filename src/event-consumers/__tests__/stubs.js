import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { RoundResultPublisher, UserBetResultPublisher } from "sc-game-base/src/core/event-publishers";
import { JackpotPublisher } from "../../event-publishers";
import { SettleGameRoundConsumer, JackpotGameConsumer, FreeSpinsConsumer, HallOfFameConsumer, JackpotConsumer, BoardCheatingConsumer } from "../";
import { BoardGenerator, BonusBoardGenerator, PaylineCalculator } from "../../board";

const settleConsumer = stub(SettleGameRoundConsumer);
const jackpotPublisher = stub(JackpotPublisher);
const jackpotGameConsumer = stub(JackpotGameConsumer);
const roundResultPublisher = stub(RoundResultPublisher);
const userBetResultPublisher = stub(UserBetResultPublisher);
const boardCheatingConsumer = stub(BoardCheatingConsumer);
const freeSpinsConsumer = stub(FreeSpinsConsumer);
const hallOfFameConsumer = stub(HallOfFameConsumer);
const jackpotConsumer = stub(JackpotConsumer);
const boardGenerator = stub(BoardGenerator);
const bonusBoardGenerator = stub(BonusBoardGenerator);
const paylineCalculator = stub(PaylineCalculator);

/** @type {mongoose.Model}*/
const roundRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const betsRepository = stubMongoose(mongoose.Model);

export {
    roundRepository,
    betsRepository,
    settleConsumer,
    jackpotPublisher,
    jackpotGameConsumer,
    roundResultPublisher,
    userBetResultPublisher,
    boardCheatingConsumer,
    freeSpinsConsumer,
    hallOfFameConsumer,
    jackpotConsumer,
    boardGenerator,
    bonusBoardGenerator,
    paylineCalculator,
};
