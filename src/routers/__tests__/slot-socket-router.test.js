import { stub } from "jest-micro-auto-stub";
import { logger } from "sc-common/logger";
import { Core } from "sc-game-base";
import { BaseSocketRouter } from "sc-game-base/src/core/routers";

import { SlotSocketRouter } from "..";
import { BonusConsumer, InGameConsumer, PlaceBetConsumer } from "../../event-consumers";
import { HallOfFameQuery, SlotHistoryQuery } from "../../query-apis";
import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";

const definition = new SlotGameDefinition({ id: 1, name: "game name" });
const gameData = new SlotGameData(0);
/** @type {UserSignInConsumer} */
const userSignInConsumer = stub(Core.BaseEventPublishers.UserSignInConsumer);
/** @type {InGameConsumer} */
const inGameConsumer = stub(InGameConsumer);
/** @type {PlaceBetConsumer} */
const placeBetConsumer = stub(PlaceBetConsumer);
/** @type {BonusConsumer} */
const bonusConsumer = stub(BonusConsumer);
/** @type {UserDisconnectConsumer} */
const userDisconnectConsumer = stub(Core.BaseEventPublishers.UserDisconnectConsumer);
/** @type {UserSignInPublisher} */
const userSignInPublisher = stub(Core.BaseEventPublishers.UserSignInPublisher);
/** @type {HistoryQuery} */
const historyQuery = stub(SlotHistoryQuery);
/** @type {HallOfFameQuery} */
const fameQuery = stub(HallOfFameQuery);
/** @type {logger} */
const logService = stub(logger);

const socketClient = {
    id: "socket-id",
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
};

describe("SlotSocketRouter", () => {
    it("instance should inherit BaseSocketRouter", () => {
        // act
        const router = initRouter();

        // assert
        expect(router instanceof BaseSocketRouter);
    });
});

describe("init", () => {
    it("should always bind approriate events", () => {
        // arrange
        const router = initRouter();

        // act
        router.init(socketClient);

        // assert
        expect(socketClient.on).toHaveBeenCalledTimes(8);
    });
});

describe("handleGettingBigWinningWinners", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should not call hallOfFameQuery when invalid request", async () => {
        // arrange
        const router = initRouter();
        spyOn(router, "verify").and.returnValue(false);
        spyOn(fameQuery, "queryBigWinningWinners");

        // act
        await router.handleGettingBigWinningWinners({});

        // assert
        expect(fameQuery.queryBigWinningWinners).not.toHaveBeenCalled();
    });

    it("emit big winning players if valid request", async () => {
        // arrange
        const router = initRouter();
        router.init(socketClient);
        const bigWinners = {
            bigWinningWinners: {
                winners: [{ name: "a", winningAmount: 12 }],
                page: 1,
                total: 1,
                pageSize: 10,
            },
        };
        spyOn(router, "verify").and.returnValue(true);
        spyOn(fameQuery, "queryBigWinningWinners").and.returnValue(bigWinners);

        // act
        await router.handleGettingBigWinningWinners({});

        // assert
        expect(fameQuery.queryBigWinningWinners).toHaveBeenCalled();
        expect(socketClient.emit).toHaveBeenCalledWith(definition.name, bigWinners);
    });

    it("should log error when have exception", async () => {
        // arrange
        const router = initRouter();
        spyOn(router, "verify").and.returnValue(true);
        spyOn(fameQuery, "queryBigWinningWinners").and.throwError("error");

        // act
        await router.handleGettingBigWinningWinners({});

        // assert
        expect(logService.logError).toHaveBeenCalled();
    });
});

describe("handleGettingJackpotWinners", () => {
    beforeEach(() => {
        jest.clearAllMocks();
   
        gameData.realPlayers[socketClient.id] = {
            socketClient,
            session: {
                disableJackpotGames: false,
            },
        }; });

    it("should not call hallOfFameQuery when invalid request", async () => {
        // arrange
        const router = initRouter();
        spyOn(router, "verify").and.returnValue(false);
        spyOn(fameQuery, "queryJackpotWinners");

        // act
        await router.handleGettingJackpotWinners({});

        // assert
        expect(fameQuery.queryJackpotWinners).not.toHaveBeenCalled();
    });

    it("should not call hallOfFameQuery when disableJackpotGames=true", async () => {
        // arrange
        const router = initRouter();
        spyOn(router, "verify").and.returnValue(true);
        spyOn(fameQuery, "queryJackpotWinners");
        gameData.realPlayers[socketClient.id].session.disableJackpotGames = true;

        // act
        await router.handleGettingJackpotWinners({});

        // assert
        expect(fameQuery.queryJackpotWinners).not.toHaveBeenCalled();
    });

    it("emit jackpot winners if valid request", async () => {
        // arrange
        const router = initRouter();
        router.init(socketClient);
        const jackpotWinners = {
            jackpotWinners: {
                winners: [{ name: "a", winningAmount: 12, pool: 1 }],
                page: 1,
                total: 1,
                pageSize: 10,
            },
        };
        spyOn(router, "verify").and.returnValue(true);
        spyOn(fameQuery, "queryJackpotWinners").and.returnValue(jackpotWinners);

        // act
        await router.handleGettingJackpotWinners({});

        // assert
        expect(fameQuery.queryJackpotWinners).toHaveBeenCalled();
        expect(socketClient.emit).toHaveBeenCalledWith(definition.name, jackpotWinners);
    });

    it("should log error when have exception", async () => {
        // arrange
        const router = initRouter();
        spyOn(router, "verify").and.returnValue(true);
        spyOn(fameQuery, "queryJackpotWinners").and.throwError("error");

        // act
        await router.handleGettingJackpotWinners({});

        // assert
        expect(logService.logError).toHaveBeenCalled();
    });
});

describe("handleBonus", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should not call bonusConsumer when invalid request", async () => {
        // arrange
        const router = initRouter();
        spyOn(router, "verify").and.returnValue(false);
        spyOn(bonusConsumer, "consume");

        // act
        await router.handleBonus({});

        // assert
        expect(bonusConsumer.consume).not.toHaveBeenCalled();
    });

    it("should call bonusConsumer when valid request", async () => {
        // arrange
        const router = initRouter();
        router.init(socketClient);
        spyOn(router, "verify").and.returnValue(true);
        gameData.realPlayers = [];

        // act
        await router.handleBonus({});

        // assert
        expect(bonusConsumer.consume).toHaveBeenCalled();
    });

    it("should log error when have exception", async () => {
        // arrange
        const router = initRouter();
        spyOn(router, "verify").and.returnValue(true);

        // act
        await router.handleBonus({});

        // assert
        expect(logService.logError).toHaveBeenCalled();
    });
});

describe("handleDisconnect", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should call userDisconnectConsumer when valid request", async () => {
        // arrange
        const router = initRouter();

        // act
        await router.handleDisconnect({});

        // assert
        expect(userDisconnectConsumer.consume).toHaveBeenCalled();
    });

    it("should log error when have exception", async () => {
        // arrange
        const router = initRouter();
        spyOn(userDisconnectConsumer, "consume").and.throwError("error");

        // act
        await router.handleDisconnect({});

        // assert
        expect(logService.logError).toHaveBeenCalled();
    });
});

function initRouter() {
    return new SlotSocketRouter({
        definition,
        gameData,
        userSignInConsumer,
        inGameConsumer,
        placeBetConsumer,
        bonusConsumer,
        userDisconnectConsumer,
        userSignInPublisher,
        historyQuery,
        hallOfFameQuery: fameQuery,
        logService,
    });
}
