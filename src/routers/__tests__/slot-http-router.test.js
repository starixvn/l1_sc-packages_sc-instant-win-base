import { stub, stubMongooseModelStupidly } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import { logger } from "sc-common";
import { HttpRouter } from "sc-game-base/src/core/routers";

import { SlotHttpRouter } from "..";
import { PaylineCalculator } from "../../board";
import SlotGameData from "../../slot-game-data";

const gameData = stubGameData();
const appConfigs = {
    apiSettings: {
        authUrl: "http://localhost",
    },
    authenticateSettings: {
        audiences: [],
    },
};
const app = { get: jest.fn(), post: jest.fn() };
const paylineCalculator = stub(PaylineCalculator);
const logService = stub(logger);

describe("SlotHttpRouter", () => {
    it("instance should inherit HttpRouter", () => {
        // arrange
        const router = new SlotHttpRouter(appConfigs, gameData, paylineCalculator, logService);

        // assert
        expect(router instanceof HttpRouter);
    });
});

describe("init", () => {
    it("should call supper init", () => {
        // arrange
        const router = new SlotHttpRouter(appConfigs, gameData, paylineCalculator, logService);
        spyOn(HttpRouter.prototype, "init");

        // act
        router.init(app);

        // assert
        expect(HttpRouter.prototype.init).toHaveBeenCalled();
    });

    it("should call app.post", () => {
        // arrange
        const router = new SlotHttpRouter(appConfigs, gameData, paylineCalculator, logService);

        // act
        router.init(app);

        // assert
        expect(app.post).toHaveBeenCalled();
    });
});

describe("handleSetBoard", () => {
    it("should call app.post", () => {
        // arrange
        const router = new SlotHttpRouter(appConfigs, gameData, paylineCalculator, logService);

        // act
        router.init(app);

        // assert
        expect(app.post).toHaveBeenCalled();
    });
});

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

    return gameData;
}
