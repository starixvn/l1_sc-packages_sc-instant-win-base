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
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("consume", () => {
        let consumer;
        const mockPlayer = { session: { playerId: "player1" }, UID: "uid1", profile: { name: "player1" } };
        const mockPayload = { chest: 1 };
        const mockJackpot = { picked: false, prizes: [10, 20, 100], winningLine: 5 };

        beforeEach(() => {
            const gameData = stubGameData();
            consumer = new JackpotGameConsumer(gameDefinition, gameData, publisher, settleConsumer, roundRepository);

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
