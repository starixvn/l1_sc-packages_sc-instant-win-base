import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";

import { FreeSpinsConsumer, IdCountersConsumer } from "..";
import SlotGameData from "../../slot-game-data";

const gameData = stubGameData();

/** @type {mongoose.Model}*/
const freeSpinsRepository = stubMongoose(mongoose.Model);

/** @type {mongoose.Model}*/
const gameNotificationsRepository = stubMongoose(mongoose.Model);

const idCountersConsumer = stub(IdCountersConsumer);

describe("hasFreeSpin", () => {
    it("should return false when no players has free spins", () => {
        // arrange
        const consumer = initConsumer();

        // act
        const result = consumer.hasFreeSpin(stubPlayer());

        // assert
        expect(result).toBeFalse();
    });

    it("should return false when players has expired free spins", () => {
        // arrange
        const consumer = initConsumer();
        const player = stubPlayer();
        gameData.ingame[player.name] = { freeSpins: [{ available: 2, expiryTime: Date.now() - 3000 * 60 }] };

        // act
        const result = consumer.hasFreeSpin(stubPlayer());

        // assert
        expect(result).toBeFalse();
    });

    it("should return true when players has free spins", () => {
        // arrange
        const consumer = initConsumer();
        const player = stubPlayer();
        gameData.ingame[player.profile.name] = { freeSpins: [{ available: 2, expiryTime: Date.now() + 3000 * 60 }] };

        // act
        const result = consumer.hasFreeSpin(player);

        // assert
        expect(result).toBeTrue();
    });
});

describe("useFreeSpin", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should call freeSpinsRepository and decrease available spins", async () => {
        // arrange
        const consumer = initConsumer();
        const player = stubPlayer();
        const availableSpin = { id: 1, available: 2, expiryTime: Date.now() + 3000 * 60 };
        // gameData.ingame[player.profile.name] = {
        //     freeSpins: [availableSpin],
        // };
        jest.spyOn(consumer, "getSoonestExpiredFreeSpinSet").mockReturnValueOnce(availableSpin);

        // act
        await consumer.useFreeSpin(player);

        // assert
        expect(freeSpinsRepository.updateOne).toHaveBeenCalledWith({ id: 1 }, { $inc: { available: -1 } });
        expect(availableSpin.available).toBe(1);
    });

    it("should not call freeSpinsRepository when not have any available spins", async () => {
        // arrange
        const consumer = initConsumer();
        const player = stubPlayer();
        jest.spyOn(consumer, "getSoonestExpiredFreeSpinSet").mockReturnValueOnce(undefined);

        // act
        await consumer.useFreeSpin(player);

        // assert
        expect(freeSpinsRepository.updateOne).not.toBeCalled();
    });
});

describe("getSoonestExpiredFreeSpinSet", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("when not in game should return undefined", () => {
        // arrange
        const consumer = initConsumer();
        const player = stubPlayer();
        gameData.ingame[player.profile.name] = null;

        // act
        const spin = consumer.getSoonestExpiredFreeSpinSet(player);

        // assert
        expect(spin).toBeUndefined();
    });

    it("should return first available spin", () => {
        // arrange
        const consumer = initConsumer();
        const player = stubPlayer();
        const availableSpin = { id: 1, available: 2, expiryTime: Date.now() + 3000 * 60 };
        gameData.ingame[player.profile.name] = {
            freeSpins: [availableSpin],
        };

        // act
        const spin = consumer.getSoonestExpiredFreeSpinSet(player);

        // assert
        expect(spin.available).toBe(2);
    });

    it("should not return spin if expired", () => {
        // arrange
        const consumer = initConsumer();
        const player = stubPlayer();
        const availableSpin = { id: 1, available: 2, expiryTime: Date.now() - 3000 * 60 };
        gameData.ingame[player.profile.name] = {
            freeSpins: [availableSpin],
        };

        // act
        const spin = consumer.getSoonestExpiredFreeSpinSet(player);

        // assert
        expect(spin).toBeUndefined();
    });
});

describe("getLatestExpiredFreeSpinSet", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        gameData.ingame = {};
    });

    it("when not in game should return undefined", () => {
        // arrange
        const consumer = initConsumer();
        const player = stubPlayer();
        gameData.ingame[player.profile.name] = null;

        // act
        const spin = consumer.getLatestExpiredFreeSpinSet(player);

        // assert
        expect(spin).toBeUndefined();
    });

    it("should return latest expiry spin", () => {
        // arrange
        const consumer = initConsumer();
        const player = stubPlayer();
        gameData.ingame[player.profile.name] = {
            freeSpins: [
                { id: 1, available: 2, expiryTime: Date.now() + 3000 * 60 },
                { id: 2, available: 3, expiryTime: Date.now() + 2000 * 60 },
            ],
        };

        // act
        const spin = consumer.getLatestExpiredFreeSpinSet(player);

        // assert
        expect(spin.available).toBe(3);
        expect(spin.id).toBe(2);
    });
});

describe("getTotalAvaiableFreeSpins", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        gameData.ingame = {};
    });

    it("should return total of avalable spin", () => {
        // arrange
        const consumer = initConsumer();
        const player = stubPlayer();
        gameData.ingame[player.profile.name] = {
            freeSpins: [
                { id: 1, available: 2, expiryTime: Date.now() + 3000 * 60 },
                { id: 2, available: 3, expiryTime: Date.now() + 2000 * 60 },
            ],
        };

        // act
        const total = consumer.getTotalAvaiableFreeSpins(player);

        // assert
        expect(total).toBe(5);
    });

    it("should return 0 if not have free spins", () => {
        // arrange
        const consumer = initConsumer();
        const player = stubPlayer();

        // act
        const total = consumer.getTotalAvaiableFreeSpins(player);

        // assert
        expect(total).toBe(0);
    });
});

describe("gainFreeSpin", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        gameData.ingame = {};
    });

    it("should call increase freespin id, store new spin and update cache", async () => {
        // arrange
        const consumer = initConsumer();
        const player = stubPlayer();
        const bet = { roundId: 1, bet: 1, paylines: [1, 2, 3], numberOfFreeSpins: 3 };
        gameData.ingame[player.profile.name] = {};
        freeSpinsRepository.create.mockReturnValueOnce({ id: 1 });

        // act
        await consumer.gainFreeSpin(player, bet, 1000);

        // assert
        expect(idCountersConsumer.consume).toHaveBeenCalledWith("freespin");
        expect(freeSpinsRepository.create).toBeCalled();
        expect(gameData.freeSpinId).toBe(2);
        expect(gameData.ingame[player.profile.name].freeSpins.length).toBe(1);
    });
});

describe("reload", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        gameData.ingame = {
            A: {},
        };
    });

    it("should cleanUpGameNotifications", async () => {
        // arrange
        const consumer = initConsumer();
        jest.spyOn(consumer, "queryFreeSpins").mockReturnValueOnce([]);
        jest.spyOn(consumer, "cleanUpGameNotifications");

        // act
        await consumer.reload();

        // assert
        expect(consumer.cleanUpGameNotifications).toBeCalled();
    });

    it("should load free spins to game data", async () => {
        // arrange
        const consumer = initConsumer();
        jest.spyOn(consumer, "queryFreeSpins").mockReturnValueOnce([
            { id: 1, name: "A", available: 2, total: 3 },
            { id: 2, name: "B", available: 4, total: 5 },
        ]);

        // act
        await consumer.reload();

        // assert
        expect(gameData.ingame["A"].freeSpins).not.toBeEmpty();
        expect(gameData.ingame["B"].freeSpins).not.toBeEmpty();
    });
});

describe("queryFreeSpins", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        gameData.ingame = {};
    });

    it("should return value from freeSpinsRepository", async () => {
        // arrange
        const consumer = initConsumer();
        freeSpinsRepository.find().lean().exec.mockReturnValueOnce([]);

        // act
        const result = await consumer.queryFreeSpins();

        // assert
        expect(result).toBeEmpty();
    });
});

describe("cleanUpGameNotifications", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        gameData.ingame = {};
    });

    it("always call gameNotificationsRepository to delete", async () => {
        // arrange
        const consumer = initConsumer();
        freeSpinsRepository.find().lean().exec.mockReturnValueOnce({});

        // act
        await consumer.cleanUpGameNotifications({});

        // assert
        expect(gameNotificationsRepository.deleteMany).toBeCalledWith({ gameId: consumer.gameId, uid: { $nin: [] } });
    });

    it("should update notification with latest expiry time of spin", async () => {
        // arrange
        const consumer = initConsumer();
        const freeSpinsGroupedByUIDs = {
            uid1: [{ name: "A", available: 2, total: 3, expiryTime: Date.now() + 3000 * 60 }],
            uid2: [{ name: "B", available: 3, total: 3, expiryTime: Date.now() + 2000 * 60 }],
        };

        // act
        await consumer.cleanUpGameNotifications(freeSpinsGroupedByUIDs);

        // assert
        expect(gameNotificationsRepository.updateOne).toBeCalledTimes(2);
    });
});

function initConsumer() {
    return new FreeSpinsConsumer(1, gameData, freeSpinsRepository, gameNotificationsRepository, idCountersConsumer);
}

function stubGameData() {
    const gameData = new SlotGameData();

    gameData.remainingTime = 20;
    gameData.gameConfigs = {
        enabled: true,
        minbet: 1,
        maxbet: 1000,
        slotsConfig: {
            stakeLevels: [{ stake: 0.1 }, { stake: 1 }, { stake: 5 }],
        },
    };
    gameData.freeSpinId = 1;

    return gameData;
}

function stubPlayer() {
    return {
        profile: { name: "A" },
    };
}
