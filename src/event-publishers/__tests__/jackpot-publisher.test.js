import JackpotPublisher from "../jackpot-publisher";
import { Core } from "sc-game-base";
import authenticationHelpers from "sc-game-base/src/core/helpers/authentication-helpers";

jest.mock("sc-game-base/src/core/helpers/authentication-helpers");

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
        it("should publishToAllUsers with correct info", () => {
            // arrange
            const publisher = new JackpotPublisher();
            publisher.publishToAllUsers = jest.fn();

            // act
            publisher.publishLatestPool(1);

            // assert
            expect(publisher.publishToAllUsers).toBeCalledWith(expect.objectContaining({ jackpotPool: 1 }));
        });
    });

    describe("publishWinner", () => {
        it("should publishToAllUsers with correct info", async () => {
            // arrange
            const publisher = new JackpotPublisher();
            publisher.publishToUser = jest.fn();
            publisher.publishToAllUsers = jest.fn();
            publisher.sendJackpotWinner = jest.fn();

            // act
            await publisher.publishWinner(1, { username: "winner" });

            // assert
            expect(publisher.publishToAllUsers).toBeCalledWith(expect.objectContaining({ jackpotWinner: { username: "winner" } }));
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
});
