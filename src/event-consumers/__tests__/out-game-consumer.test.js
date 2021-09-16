import OutGameConsumer from "../out-game-consumer";
import { Core } from "sc-game-base";

describe("out-game-consumer", () => {
    describe("extends", () => {
        it("should extend Core.BaseEventConsumers.UserDisconnectConsumer", () => {
            // act
            const consumer = new OutGameConsumer();

            // assert
            expect(consumer instanceof Core.BaseEventConsumers.UserDisconnectConsumer);
        });
    });

    describe("consume", () => {
        it("when have realPlayers should call autoOpenRemainingChests", () => {
            // arrange
            const gameData = { realPlayers: { user1: {} } };
            const socketClient = { id: "user1" };
            const bonusConsumer = { autoOpenRemainingChests: jest.fn() };
            const consumer = new OutGameConsumer(1, gameData, bonusConsumer);
            consumer.upsertFreeSpinNotification = jest.fn();

            // act
            consumer.consume(socketClient);

            // assert
            expect(consumer.bonusConsumer.autoOpenRemainingChests).toBeCalled();
        });

        it("when not have realPlayers should not call autoOpenRemainingChests", () => {
            // arrange
            const gameData = { realPlayers: {} };
            const socketClient = { id: "user1" };
            const bonusConsumer = { autoOpenRemainingChests: jest.fn() };
            const consumer = new OutGameConsumer(1, gameData, bonusConsumer);
            consumer.upsertFreeSpinNotification = jest.fn();

            // act
            consumer.consume(socketClient);

            // assert
            expect(consumer.bonusConsumer.autoOpenRemainingChests).not.toBeCalled();
        });
    });

    describe("upsertFreeSpinNotification", () => {
        it("when not have latestExpiredFreeSpinSet should call gameNotificationsRepository.deleteOne", () => {
            // arrange
            const gameData = { realPlayers: { user1: {} } };
            const bonusConsumer = { autoOpenRemainingChests: jest.fn() };
            const freeSpinsConsumer = { getLatestExpiredFreeSpinSet: jest.fn() };
            freeSpinsConsumer.getLatestExpiredFreeSpinSet.mockReturnValueOnce(null);

            const gameNotificationsRepository = { deleteOne: jest.fn() };
            const consumer = new OutGameConsumer(1, gameData, bonusConsumer, freeSpinsConsumer, gameNotificationsRepository);

            // act
            consumer.upsertFreeSpinNotification({});

            // assert
            expect(consumer.gameNotificationsRepository.deleteOne).toBeCalled();
        });

        it("when have latestExpiredFreeSpinSet should call gameNotificationsRepository.deleteOne", () => {
            // arrange
            const gameData = { realPlayers: { user1: {} } };
            const bonusConsumer = { autoOpenRemainingChests: jest.fn() };
            const freeSpinsConsumer = { getLatestExpiredFreeSpinSet: jest.fn() };
            freeSpinsConsumer.getLatestExpiredFreeSpinSet.mockReturnValueOnce({});

            const gameNotificationsRepository = { updateOne: jest.fn() };
            const consumer = new OutGameConsumer(1, gameData, bonusConsumer, freeSpinsConsumer, gameNotificationsRepository);

            // act
            consumer.upsertFreeSpinNotification({});

            // assert
            expect(consumer.gameNotificationsRepository.updateOne).toBeCalled();
        });
    });
});
