import { stub, stubMongoose } from "jest-micro-auto-stub";
import mongoose from "mongoose";
import JackpotGameConsumer from "../jackpot-game-consumer";
import { JackpotPublisher } from "../../event-publishers";
import SlotNoticeHelper from "../../helpers/slot-notice-helper";
import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";

import SettleGameRoundConsumer from "../settle-game-round-consumer";

const gameDefinition = stubGameDefinition();
const settleConsumer = stub(SettleGameRoundConsumer);
const publisher = stub(JackpotPublisher);

/** @type {mongoose.Model}*/
const roundRepository = stubMongoose(mongoose.Model);

describe("JackpotGameConsumer", () => {
    const mockPlayer = { session: { playerId: "player1" }, UID: "uid1", profile: { name: "player1" } };

    let consumer;

    beforeEach(() => {
        const gameData = stubGameData();
        consumer = new JackpotGameConsumer(gameDefinition, gameData, publisher, settleConsumer, roundRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("consume", () => {
        const mockPayload = { chest: 1 };
        const mockJackpot = { picked: false, prizes: [10, 20, 100], winningLine: 5 };

        beforeEach(() => {
            consumer.gameData.ingame["player1"] = {
                jackpot: mockJackpot,
            };
        });

        describe("when validation fails", () => {
            it("should not proceed", async () => {
                // Arrange
                jest.spyOn(consumer, "validate").mockReturnValue(false);

                // Act
                await consumer.consume(mockPlayer, mockPayload);

                // Assert
                expect(consumer.roundsRepository.findOneAndUpdate).not.toHaveBeenCalled();
            });
        });

        describe("when validation pass", () => {
            beforeEach(() => {
                jest.spyOn(consumer, "validate").mockReturnValue(true);
            });

            it("always find and update bet with jackpot picked as TRUE", async () => {
                // Arrange
                jest.spyOn(consumer.roundsRepository, "findOneAndUpdate");

                // Act
                await consumer.consume(mockPlayer, mockPayload);

                // Assert
                expect(consumer.roundsRepository.findOneAndUpdate).toHaveBeenCalledTimes(1);
                expect(consumer.roundsRepository.findOneAndUpdate).toHaveBeenCalledWith(
                    { playerId: mockPlayer.session.playerId, paid: false, jackpot: { picked: false } },
                    { $set: { jackpot: { picked: true } } },
                    {
                        new: true,
                        lean: true,
                    }
                );
            });

            describe("when bet is not found", () => {
                it("should publish invalid bonus notice", async () => {
                    // Arrange
                    consumer.roundsRepository.findOneAndUpdate.mockResolvedValue(null);
                    jest.spyOn(consumer.jackpotPublisher, "publishToUser");

                    // Act
                    await consumer.consume(mockPlayer, mockPayload);

                    // Assert
                    expect(consumer.jackpotPublisher.publishToUser).toHaveBeenCalledWith("uid1", {
                        endBet: -1,
                        notice: { errorCode: SlotNoticeHelper.invalidBonus },
                    });
                });
            });

            describe("when bet is found", () => {
                const mockWinningAmount = 1000;
                const mockWinningLine = 5;
                const mockBet = { playerId: "", id: 123, totalAmount: 2.5 };

                beforeEach(() => {
                    consumer.roundsRepository.findOneAndUpdate.mockResolvedValue(mockBet);

                    consumer.settleGameRoundConsumer.processJackpot.mockResolvedValue({
                        winningAmount: mockWinningAmount,
                        winningLine: mockWinningLine,
                    });
                });

                it("should update gameData with jackpot picked as TRUE", async () => {
                    // Arrange

                    // Act
                    await consumer.consume(mockPlayer, mockPayload);

                    // Assert
                    expect(consumer.gameData.ingame["player1"].jackpot.picked).toBe(true);
                });

                it("should process jackpot with picked prize", async () => {
                    // Arrange

                    // Act
                    await consumer.consume(mockPlayer, mockPayload);

                    // Assert
                    expect(consumer.gameData.ingame["player1"].jackpot.picked).toBe(true);
                    expect(consumer.settleGameRoundConsumer.processJackpot).toHaveBeenCalledWith(
                        mockPlayer,
                        mockBet.id,
                        mockBet,
                        mockJackpot.winningLine,
                        20
                    );
                });

                it("should settle game round with jackpot win", async () => {
                    // Arrange
                    const mockWinningAmount = 1000;
                    const settleWithJackpotWinSpy = jest.spyOn(consumer.settleGameRoundConsumer, "settleWithJackpotWin").mockResolvedValue();

                    // Act
                    await consumer.consume(mockPlayer, mockPayload);

                    // Assert
                    expect(consumer.gameData.ingame["player1"].jackpot.picked).toBe(true);
                    expect(settleWithJackpotWinSpy).toHaveBeenCalledWith({
                        roundId: mockBet.id,
                        prize: 20,
                        winningAmount: mockWinningAmount,
                        winningLine: mockWinningLine,
                    });
                });
            });
        });
    });

    describe("isInvalidChest", () => {
        it("should return true if chest is not a number", () => {
            // Arrange
            const chest = "not-a-number";
            const prizes = [100, 200, 300];

            // Act
            const result = consumer.isInvalidChest(chest, prizes);

            // Assert
            expect(result).toBe(true);
        });

        it("should return true if chest is a negative number", () => {
            // Arrange
            const chest = -1;
            const prizes = [100, 200, 300];

            // Act
            const result = consumer.isInvalidChest(chest, prizes);

            // Assert
            expect(result).toBe(true);
        });

        it("should return true if chest is greater than or equal to the length of prizes", () => {
            // Arrange
            const chest = 3;
            const prizes = [100, 200, 300];

            // Act
            const result = consumer.isInvalidChest(chest, prizes);

            // Assert
            expect(result).toBe(true);
        });

        it("should return false if chest is a valid number within the range of prizes", () => {
            // Arrange
            const chest = 1;
            const prizes = [100, 200, 300];

            // Act
            const result = consumer.isInvalidChest(chest, prizes);

            // Assert
            expect(result).toBe(false);
        });

        it("should return false if chest is 0 and prizes is not empty", () => {
            // Arrange
            const chest = 0;
            const prizes = [100, 200, 300];

            // Act
            const result = consumer.isInvalidChest(chest, prizes);

            // Assert
            expect(result).toBe(false);
        });
    });

    describe("validate", () => {
        const mockJackpot = { picked: false, prizes: [10, 20, 100], winningLine: 5 };

        beforeEach(() => {
            consumer.gameData.ingame["player1"] = {
                jackpot: mockJackpot,
            };
        });

        it("should return false and publish notice if jackpot is already picked", () => {
            // Arrange
            consumer.gameData.ingame["player1"].jackpot.picked = true;
            jest.spyOn(publisher, "publishToUser");

            // Act
            const result = consumer.validate(mockPlayer, 1);

            // Assert
            expect(result).toBe(false);
            expect(publisher.publishToUser).toHaveBeenCalledWith("uid1", { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidBonus } });
        });

        it("should return false and publish notice if chest is invalid", () => {
            // Arrange
            const invalidChest = 3; // Out of bounds
            jest.spyOn(publisher, "publishToUser");

            // Act
            const result = consumer.validate(mockPlayer, invalidChest);

            // Assert
            expect(result).toBe(false);
            expect(publisher.publishToUser).toHaveBeenCalledWith("uid1", { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidBonus } });
        });

        it("should return true if jackpot is not picked and chest is valid", () => {
            // Arrange
            const validChest = 1;
            consumer.gameData.ingame["player1"].jackpot.picked = false;
            jest.spyOn(publisher, "publishToUser");

            // Act
            const result = consumer.validate(mockPlayer, validChest);

            // Assert
            expect(result).toBe(true);
            expect(publisher.publishToUser).not.toHaveBeenCalled();
        });

        it("should handle players not in game data", () => {
            // Arrange
            const newPlayer = { UID: "uid2", profile: { name: "newPlayer" } };
            const chest = 1;
            jest.spyOn(publisher, "publishToUser");

            // Act
            const result = consumer.validate(newPlayer, chest);

            // Assert
            expect(result).toBe(false);
            expect(publisher.publishToUser).toHaveBeenCalledWith("uid2", { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidBonus } });
        });
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
            betLevels: [0.1, 0.2, 1, 1.5],
        },
    };

    return gameData;
}

function stubGameDefinition() {
    return new SlotGameDefinition({
        choices: [1, 2, 3, 4, 5],
    });
}
