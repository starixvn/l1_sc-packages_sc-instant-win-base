import { UserSignInConsumer } from "..";

describe("handleSignInSuccess", () => {
    // arrange
    const userSignInPublisher = { publishToGameMessage: jest.fn(), publishNotPermittedToPlayMessage: jest.fn() };

    it("when jackpot not enabled should signedIn", () => {
        // arrange
        const gameData = {
            gameConfigs: {
                slotsConfig: {
                    jackpot: { allowedCurrencies: null, enabled: false },
                },
            },
            realPlayers: {},
        };
        const consumer = new UserSignInConsumer({}, gameData, userSignInPublisher);
        const socketClient = { emit: jest.fn() };
        const userInfo = {};
        const userSession = {};

        // act
        consumer.handleSignInSuccess(socketClient, userInfo, userSession);

        // assert
        expect(socketClient.emit).toBeCalledWith("signedIn");
    });

    it("when isTestCurrency should signedIn", () => {
        // arrange
        const gameData = {
            gameConfigs: {
                slotsConfig: {
                    jackpot: { allowedCurrency: null, enabled: true },
                },
            },
            realPlayers: {},
        };
        const consumer = new UserSignInConsumer({}, gameData, userSignInPublisher);
        const socketClient = { emit: jest.fn() };
        const userInfo = {};
        const userSession = { isTestCurrency: true };

        // act
        consumer.handleSignInSuccess(socketClient, userInfo, userSession);

        // assert
        expect(socketClient.emit).toBeCalledWith("signedIn");
    });

    it("when user currency is allowedCurrency should signedIn", () => {
        // arrange
        const gameData = {
            gameConfigs: {
                slotsConfig: {
                    jackpot: {
                        enabled: true,
                        allowedCurrency: "inh",
                    },
                },
            },
            realPlayers: {},
        };
        const consumer = new UserSignInConsumer({}, gameData, userSignInPublisher);
        const socketClient = { emit: jest.fn() };
        const userInfo = {};
        const userSession = { isTestCurrency: false, currencyName: "INH" };

        // act
        consumer.handleSignInSuccess(socketClient, userInfo, userSession);

        // assert
        expect(socketClient.emit).toBeCalledWith("signedIn");
    });

    it("when user currency is not allowedCurrency should not signedIn", () => {
        // arrange
        const gameData = {
            gameConfigs: {
                slotsConfig: {
                    jackpot: {
                        enabled: true,
                        allowedCurrency: "inh",
                    },
                },
            },
            realPlayers: {},
        };
        const definition = {};
        const consumer = new UserSignInConsumer(definition, gameData, userSignInPublisher, null, null, null);
        const socketClient = { emit: jest.fn() };
        const userInfo = {};
        const userSession = { isTestCurrency: false, currencyName: "UUS" };

        // act
        consumer.handleSignInSuccess(socketClient, userInfo, userSession);

        // assert
        expect(socketClient.emit).not.toBeCalledWith("signedIn");
        expect(userSignInPublisher.publishNotPermittedToPlayMessage).toBeCalled();
    });
});
