import { PlayGamePermissionValidator } from "sc-game-base/src/core/validators";
import SlotGamePlayGamePermissionValidator from "../slot-game-play-game-permission-validator";
import SlotGameData from "../../slot-game-data";

describe("SlotGamePlayGamePermissionValidator", () => {
    let permissionValidator;

    beforeEach(() => {
        permissionValidator = new SlotGamePlayGamePermissionValidator();
    });

    describe("isHavePlayingPermission", () => {
        describe("when the game has jackpot", () => {
            beforeEach(() => {
                permissionValidator.gameData = new SlotGameData(0);
                permissionValidator.gameData.gameConfigs = { slotsConfig: { jackpot: { enabled: true } } };
            });
            describe("when userSession.disableJackpotGames is true", () => {
                it("should return false", async () => {
                    // Arrange
                    const userSession = { disableJackpotGames: true };

                    // Act
                    const actualValue = await permissionValidator.isHavePlayingPermission(userSession);

                    // Assert
                    expect(actualValue).toBeFalse();
                });
            });

            describe("when userSession.disableJackpotGames is false", () => {
                describe("when other conditions is not passed", () => {
                    it("should return false", async () => {
                        // Arrange
                        const userSession = { disableJackpotGames: false };
                        jest.spyOn(PlayGamePermissionValidator.prototype, "isHavePlayingPermission").mockReturnValueOnce(false);

                        // Act
                        const actualValue = await permissionValidator.isHavePlayingPermission(userSession);

                        // Assert
                        expect(actualValue).toBeFalse();
                    });
                });

                describe("when other conditions is  passed", () => {
                    it("should return true", async () => {
                        // Arrange
                        const userSession = { disableJackpotGames: false };
                        jest.spyOn(PlayGamePermissionValidator.prototype, "isHavePlayingPermission").mockReturnValueOnce(true);

                        // Act
                        const actualValue = await permissionValidator.isHavePlayingPermission(userSession);

                        // Assert
                        expect(actualValue).toBeTrue();
                    });
                });

                describe("when other conditions is  passed && user's currency is test currency", () => {
                    it("should return true", async () => {
                        // Arrange
                        const userSession = { disableJackpotGames: false, isTestCurrency: true };
                        jest.spyOn(PlayGamePermissionValidator.prototype, "isHavePlayingPermission").mockReturnValueOnce(true);

                        // Act
                        const actualValue = await permissionValidator.isHavePlayingPermission(userSession);

                        // Assert
                        expect(actualValue).toBeTrue();
                    });
                });
            });
        });

        describe("when the game doesn't have jackpot", () => {
            beforeEach(() => {
                permissionValidator.gameData = new SlotGameData(0);
                permissionValidator.gameData.gameConfigs = { slotsConfig: { jackpot: { enabled: false } } };
            });

            describe("when other conditions is not passed", () => {
                it("should return false", async () => {
                    // Arrange
                    const userSession = { disableJackpotGames: false };
                    jest.spyOn(PlayGamePermissionValidator.prototype, "isHavePlayingPermission").mockReturnValueOnce(false);

                    // Act
                    const actualValue = await permissionValidator.isHavePlayingPermission(userSession);

                    // Assert
                    expect(actualValue).toBeFalse();
                });
            });

            describe("when other conditions is  passed", () => {
                it("should return true", async () => {
                    // Arrange
                    const userSession = { disableJackpotGames: false };
                    jest.spyOn(PlayGamePermissionValidator.prototype, "isHavePlayingPermission").mockReturnValueOnce(true);

                    // Act
                    const actualValue = await permissionValidator.isHavePlayingPermission(userSession);

                    // Assert
                    expect(actualValue).toBeTrue();
                });
            });
        });
    });
});
