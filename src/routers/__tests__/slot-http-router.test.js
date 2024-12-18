import { stub } from "jest-micro-auto-stub";
import { logger } from "sc-common/logger";
import { HttpRouter } from "sc-game-base/src/core/routers";

import { SlotHttpRouter } from "..";
import odds from "../../../tests/odds";
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
const paylineCalculator = new PaylineCalculator();
const historyQuery = {};
const metricQuery = {};
const logService = stub(logger);
const res = {
    send: jest.fn(),
};

describe("SlotHttpRouter", () => {
    it("instance should inherit HttpRouter", () => {
        // act
        const router = new SlotHttpRouter(appConfigs, gameData, historyQuery, metricQuery, logService, paylineCalculator);

        // assert
        expect(router instanceof HttpRouter);
    });
});

describe("init", () => {
    it("should call supper init", () => {
        // arrange
        const router = new SlotHttpRouter(appConfigs, gameData, historyQuery, metricQuery, logService, paylineCalculator);
        jest.spyOn(HttpRouter.prototype, "init");

        // act
        router.init(app);

        // assert
        expect(HttpRouter.prototype.init).toHaveBeenCalled();
    });

    it("should call app.post", () => {
        // arrange
        const router = new SlotHttpRouter(appConfigs, gameData, historyQuery, metricQuery, logService, paylineCalculator);

        // act
        router.init(app);

        // assert
        expect(app.post).toHaveBeenCalled();
    });
});

describe("handleSetBoard", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should logError if params are invalid", () => {
        // arrange
        const router = new SlotHttpRouter(appConfigs, gameData, historyQuery, metricQuery, logService, paylineCalculator);

        // act
        router.handleSetBoard({}, res);

        // assert
        expect(logService.logError).toHaveBeenCalled();
        expect(res.send).toHaveBeenCalledWith({ error: true });
    });

    it("should logError if monitor result is invalid", () => {
        // arrange
        const router = new SlotHttpRouter(appConfigs, gameData, historyQuery, metricQuery, logService, paylineCalculator);

        // act
        router.handleSetBoard({ name: "A", result: [] }, res);

        // assert
        expect(logService.logError).toHaveBeenCalled();
        expect(res.send).toHaveBeenCalledWith({ error: true });
    });

    it("should assign monitoring result to settlement", () => {
        // arrange
        const router = new SlotHttpRouter(appConfigs, gameData, historyQuery, metricQuery, logService, paylineCalculator);
        const playerName = "A";
        const result = [1, 2, 2, 1, 4, 4, 1, 9, 3, 4, 1, 2, 7, 2, 2];

        // act
        router.handleSetBoard({ name: playerName, result }, res);

        // assert
        expect(logService.logError).not.toHaveBeenCalled();
        expect(res.send).toHaveBeenCalled();
        expect(gameData.settlementResultFromAdmin[playerName]).toBe(result);
    });
});

describe("handleGetOpeningBonus", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should send empty if not have player ingame", () => {
        // arrange
        const router = new SlotHttpRouter(appConfigs, gameData, historyQuery, metricQuery, logService, paylineCalculator);

        // act
        router.handleGetOpeningBonus(res);

        // assert
        expect(res.send).toHaveBeenCalledWith({ usersOpeningBonus: [] });
    });

    it("should send users who are opening bonuses", () => {
        // arrange
        const router = new SlotHttpRouter(appConfigs, gameData, historyQuery, metricQuery, logService, paylineCalculator);
        const playerName = "A";
        gameData.ingame[playerName] = {
            player: { profile: { name: playerName } },
            bonusChests: [{ amount: 1, picked: false }],
        };

        // act
        router.handleGetOpeningBonus(res);

        // assert
        expect(res.send).toHaveBeenCalledWith({ usersOpeningBonus: [playerName] });
    });

    it("when has error should write log", () => {
        // arrange
        const router = new SlotHttpRouter(appConfigs, gameData, historyQuery, metricQuery, logService, paylineCalculator);
        gameData.ingame = null;

        // act
        router.handleGetOpeningBonus(res);

        // assert
        expect(router.logService.logError).toHaveBeenCalled();
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
            icons: odds,
        },
    };

    return gameData;
}
