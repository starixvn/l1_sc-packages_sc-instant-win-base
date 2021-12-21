import { UserSignInConsumer } from "..";

describe("handleSignInSuccess", () => {
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
        const consumer = new UserSignInConsumer(gameData);
        const socketClient = { emit: jest.fn() };
        const userInfo = {};
        const userSession = {};

        // act
        consumer.handleSignInSuccess(socketClient, userInfo, userSession);

        // assert
        expect(socketClient.emit).toBeCalledWith("signedIn");
    });

    it("when isTestCurrency and isAllowedTestCurrencies should signedIn", () => {
        // arrange
        const gameData = {
            gameConfigs: {
                slotsConfig: {
                    jackpot: { allowedCurrencies: null, enabled: true, isAllowedTestCurrencies: true },
                },
            },
            realPlayers: {},
        };
        const consumer = new UserSignInConsumer(gameData);
        const socketClient = { emit: jest.fn() };
        const userInfo = {};
        const userSession = { isTestCurrency: true };

        // act
        consumer.handleSignInSuccess(socketClient, userInfo, userSession);

        // assert
        expect(socketClient.emit).toBeCalledWith("signedIn");
    });

    const testCases = [
        { isAllowedTestCurrencies: true, isTestCurrency: false },
        { isAllowedTestCurrencies: false, isTestCurrency: true },
        { isAllowedTestCurrencies: false, isTestCurrency: false },
    ];
    it.each(testCases)("when  user currency in allowedCurrencies should signedIn", (testCase) => {
        // arrange
        const gameData = {
            gameConfigs: {
                slotsConfig: {
                    jackpot: {
                        allowedCurrencies: null,
                        enabled: true,
                        isAllowedTestCurrencies: testCase.isAllowedTestCurrencies,
                        allowedCurrencies: "inh",
                    },
                },
            },
            realPlayers: {},
        };
        const consumer = new UserSignInConsumer(gameData);
        const socketClient = { emit: jest.fn() };
        const userInfo = {};
        const userSession = { isTestCurrency: testCase.isTestCurrency, currency: "INH" };

        // act
        consumer.handleSignInSuccess(socketClient, userInfo, userSession);

        // assert
        expect(socketClient.emit).toBeCalledWith("signedIn");
    });

    it.each(testCases)("when  user currency not in allowedCurrencies should not signedIn", (testCase) => {
        // arrange
        const gameData = {
            gameConfigs: {
                slotsConfig: {
                    jackpot: {
                        allowedCurrencies: null,
                        enabled: true,
                        isAllowedTestCurrencies: testCase.isAllowedTestCurrencies,
                        allowedCurrencies: "inh",
                    },
                },
            },
            realPlayers: {},
        };
        const userSignInPublisher = { publishNotPermittedToPlayMessage: jest.fn() };
        const definition = {};
        const consumer = new UserSignInConsumer(gameData, userSignInPublisher, null, null, null, definition);
        const socketClient = { emit: jest.fn() };
        const userInfo = {};
        const userSession = { isTestCurrency: testCase.isTestCurrency, currency: "UUS" };

        // act
        consumer.handleSignInSuccess(socketClient, userInfo, userSession);

        // assert
        expect(socketClient.emit).not.toBeCalledWith("signedIn");
        expect(userSignInPublisher.publishNotPermittedToPlayMessage).toBeCalled();
    });
});
