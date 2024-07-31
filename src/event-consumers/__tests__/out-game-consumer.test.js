import { stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { Core } from "sc-game-base";
import OutGameConsumer from "../out-game-consumer";
import { bonusConsumer, freeSpinsConsumer, jackpotGameConsumer } from "./stubs";

const gameNotificationsRepository = stubMongoose(mongoose.Model);

describe("out-game-consumer", () => {
    afterEach(() => jest.clearAllMocks());

    describe("extends", () => {
        it("should extend Core.BaseEventConsumers.UserDisconnectConsumer", () => {
            // act
            const consumer = new OutGameConsumer();

            // assert
            expect(consumer instanceof Core.BaseEventConsumers.UserDisconnectConsumer);
        });
    });

    describe("consume", () => {
        it("when have realPlayers should call autoOpenRemainingChests", async () => {
            // arrange
            const gameData = { realPlayers: { user1: { profile: {} } } };
            const socketClient = { id: "user1" };
            const consumer = new OutGameConsumer(1, gameData, bonusConsumer, freeSpinsConsumer, gameNotificationsRepository, jackpotGameConsumer);
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
            const consumer = new OutGameConsumer(1, gameData, bonusConsumer, freeSpinsConsumer, gameNotificationsRepository, jackpotGameConsumer);
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
            const consumer = new OutGameConsumer(1, gameData, bonusConsumer, freeSpinsConsumer, gameNotificationsRepository, jackpotGameConsumer);

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

            const consumer = new OutGameConsumer(1, gameData, bonusConsumer, freeSpinsConsumer, gameNotificationsRepository, jackpotGameConsumer);

            // act
            consumer.upsertFreeSpinNotification({});

            // assert
            expect(consumer.gameNotificationsRepository.updateOne).toBeCalled();
        });
    });
});
