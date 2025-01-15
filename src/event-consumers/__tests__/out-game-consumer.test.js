import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { BaseEventPublishers } from "sc-game-base/src/core";
import OutGameConsumer from "../out-game-consumer";
import { bonusConsumer, freeSpinsConsumer, jackpotGameConsumer } from "./stubs";

const gameNotificationsRepository = stubMongoose(mongoose.Model);
const publisher = stub(BaseEventPublishers);

describe("out-game-consumer", () => {
    afterEach(() => jest.clearAllMocks());

    describe("consume", () => {
        it("when have realPlayers should call autoOpenRemainingChests", async () => {
            // arrange
            const gameData = { realPlayers: { user1: { profile: {} } }, players: { user1: {} } };
            const socketClient = { id: "user1" };
            const consumer = new OutGameConsumer(
                1,
                gameData,
                publisher,
                bonusConsumer,
                freeSpinsConsumer,
                gameNotificationsRepository,
                jackpotGameConsumer
            );
            consumer.upsertFreeSpinNotification = jest.fn();

            // act
            await consumer.consume(socketClient);

            // assert
            expect(consumer.bonusConsumer.autoOpenRemainingChests).toHaveBeenCalled();
        });

        it("when not have realPlayers should not call autoOpenRemainingChests", async () => {
            // arrange
            const gameData = { realPlayers: {} };
            const socketClient = { id: "user1" };
            const consumer = new OutGameConsumer(
                1,
                gameData,
                publisher,
                bonusConsumer,
                freeSpinsConsumer,
                gameNotificationsRepository,
                jackpotGameConsumer
            );
            consumer.upsertFreeSpinNotification = jest.fn();

            // act
            await consumer.consume(socketClient);

            // assert
            expect(consumer.bonusConsumer.autoOpenRemainingChests).not.toBeCalled();
        });
    });

    describe("upsertFreeSpinNotification", () => {
        it("when not have latestExpiredFreeSpinSet should call gameNotificationsRepository.deleteOne", () => {
            // arrange
            const gameData = { realPlayers: { user1: { profile: {} } } };
            const consumer = new OutGameConsumer(
                1,
                gameData,
                publisher,
                bonusConsumer,
                freeSpinsConsumer,
                gameNotificationsRepository,
                jackpotGameConsumer
            );

            // act
            consumer.upsertFreeSpinNotification({});

            // assert
            expect(consumer.gameNotificationsRepository.deleteOne).toBeCalled();
        });

        it("when have latestExpiredFreeSpinSet should call gameNotificationsRepository.deleteOne", () => {
            // arrange
            const gameData = { realPlayers: { user1: {} } };
            const bonusConsumer = { autoOpenRemainingChests: jest.fn() };

            freeSpinsConsumer.getLatestExpiredFreeSpinSet.mockReturnValueOnce({});

            const consumer = new OutGameConsumer(
                1,
                gameData,
                publisher,
                bonusConsumer,
                freeSpinsConsumer,
                gameNotificationsRepository,
                jackpotGameConsumer
            );

            // act
            consumer.upsertFreeSpinNotification({});

            // assert
            expect(consumer.gameNotificationsRepository.updateOne).toBeCalled();
        });
    });
});
