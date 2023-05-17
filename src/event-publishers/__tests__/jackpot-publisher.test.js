import { Core } from "sc-game-base";
import authenticationHelpers from "sc-game-base/src/core/helpers/authentication-helpers";
import JackpotPublisher from "../jackpot-publisher";

jest.mock("sc-game-base/src/core/helpers/authentication-helpers");

const gameData = {
    realPlayers: [
        {
            session: {
                disableJackpotGames: true,
            },
            socketClient: {
                emit: jest.fn(),
            },
        },
        {
            session: {
                disableJackpotGames: false,
            },
            socketClient: {
                emit: jest.fn(),
            },
        },
    ],
};

describe("jackpot-publisher", () => {
    describe("extends", () => {
        it("should extend Core.BaseEventPublishers.BaseEventPublisher", () => {
            // act
            const publisher = new JackpotPublisher();

            // assert
            expect(publisher instanceof Core.BaseEventPublishers.BaseEventPublisher);
        });
    });

    describe("publishLatestPool", () => {
        it("should publishToEligibleUsers with correct info", () => {
            // arrange
            const publisher = new JackpotPublisher(29, "FourGuardians", gameData);
            const spy = jest.spyOn(publisher, "publishToEligibleUsers");
            publisher.publishToAllUsers = jest.fn();

            // act
            publisher.publishLatestPool(1);

            // assert
            expect(spy).toBeCalledWith(expect.objectContaining({ jackpotPool: 1 }));
        });
    });

    describe("publishWinner", () => {
        it("should publishToEligibleUsers with correct info", async () => {
            // arrange
            const publisher = new JackpotPublisher(29, "FourGuardians", gameData);
            publisher.publishToUser = jest.fn();
            const spy = jest.spyOn(publisher, "publishToEligibleUsers");
            publisher.sendJackpotWinner = jest.fn();

            // act
            await publisher.publishWinner(1, { username: "winner" });

            // assert
            expect(spy).toBeCalledWith(expect.objectContaining({ jackpotWinner: { username: "winner" } }));
        });
    });

    describe("sendJackpotWinner", () => {
        it("when not have error should publishToUser with correct info", () => {
            // arrange
            const notificationServiceUrl = "notification-service";
            const appConfigs = {
                notificationServiceSettings: {
                    url: notificationServiceUrl,
                },
            };
            const publisher = new JackpotPublisher(2, "", {}, appConfigs, {});

            // act
            publisher.sendJackpotWinner({ user: "winner" });

            // assert
            expect(authenticationHelpers.post).toBeCalledWith(
                `${notificationServiceUrl}/jackpotWinner`,
                expect.objectContaining({ gameId: 2, user: "winner" })
            );
        });

        it("when have error should logError", () => {
            // arrange
            const publisher = new JackpotPublisher(2);
            publisher.notificationServiceCommunicator = undefined;
            publisher.logService = { logError: jest.fn() };

            // act
            publisher.sendJackpotWinner({ user: "winner" });

            // assert
            expect(publisher.logService.logError).toBeCalled();
        });
    });

    describe("publishFailedJackpot", () => {
        it("should publishToUser with correct info", () => {
            // arrange
            const publisher = new JackpotPublisher();
            publisher.publishToUser = jest.fn();

            // act
            publisher.publishFailedJackpot(1, "error");

            // assert
            expect(publisher.publishToUser).toBeCalledWith(1, expect.objectContaining({ jackpotError: "error" }));
        });
    });

    describe("publishToEligibleUsers", () => {
        it("should only send data to user with disableJackpotGames = true", () => {
            // arrange
            const publisher = new JackpotPublisher(29, "FourGuardians", gameData);

            // act
            publisher.publishToEligibleUsers({ jackpotPool: [] });

            // assert
            expect(gameData.realPlayers.find((x) => x.session.disableJackpotGames).socketClient.emit).not.toHaveBeenCalled();
            expect(gameData.realPlayers.find((x) => !x.session.disableJackpotGames).socketClient.emit).toHaveBeenCalledWith("FourGuardians", { jackpotPool: [] });
        });
    });
});
