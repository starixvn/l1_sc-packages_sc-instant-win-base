import SlotNoticeHelper from "../../helpers/slot-notice-helper";
import SlotGameData from "../../slot-game-data";
import SlotGameDefinition from "../../slot-game-definition";
import JackpotGameConsumer from "../jackpot-game-consumer";

import moment from "moment";

import { jackpotPublisher, roundsRepository, settleConsumer } from "../__tests__/stubs";

const gameDefinition = stubGameDefinition();

describe("JackpotGameConsumer", () => {
    const mockPlayer = { session: { playerId: "player1" }, UID: "uid1", profile: { name: "player1" } };

    let consumer;

    beforeEach(() => {
        const gameData = stubGameData();
        consumer = new JackpotGameConsumer({
            definition: gameDefinition,
            gameData,
            jackpotPublisher,
            settleGameRoundConsumer: settleConsumer,
            roundsRepository,
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("consume", () => {
        const mockPayload = { chest: 1 };
        const mockJackpot = { picked: false, prizes: ["minor", "major", "grand"], winningLine: 5 };

        beforeEach(() => {
            consumer.gameData.ingame["player1"] = {
                jackpot: { ...mockJackpot },
            };
        });

        describe("when validation fails", () => {
            it("should not proceed", async () => {
                // Arrange
                jest.spyOn(consumer, "validate").mockReturnValue(false);
                jest.spyOn(consumer, "pickJackpotAndUpdateBet");

                // Act
                await consumer.consume(mockPlayer, mockPayload);

                // Assert
                expect(consumer.pickJackpotAndUpdateBet).not.toHaveBeenCalled();
                expect(consumer.roundsRepository.findOneAndUpdate).not.toHaveBeenCalled();
            });
        });

        describe("when validation pass", () => {
            beforeEach(() => {
                jest.spyOn(consumer, "validate").mockReturnValue(true);
            });

            it("always pick jackpot and update bet", async () => {
                // Arrange
                jest.spyOn(consumer.roundsRepository, "findOneAndUpdate");
                jest.spyOn(consumer, "pickJackpotAndUpdateBet").mockReturnValueOnce({ bet: null, prize: null });

                // Act
                await consumer.consume(mockPlayer, mockPayload);

                // Assert
                expect(consumer.pickJackpotAndUpdateBet).toHaveBeenCalledTimes(1);
                expect(consumer.pickJackpotAndUpdateBet).toHaveBeenCalledWith({ player: mockPlayer, chest: mockPayload.chest });
            });

            describe("when bet is not found", () => {
                it("should publish jackpot failed", async () => {
                    // Arrange
                    jest.spyOn(consumer, "pickJackpotAndUpdateBet").mockReturnValueOnce({ bet: null, prize: null });
                    jest.spyOn(consumer.jackpotPublisher, "publishToUser");

                    // Act
                    await consumer.consume(mockPlayer, mockPayload);

                    // Assert
                    expect(consumer.jackpotPublisher.publishToUser).toHaveBeenCalledWith("uid1", {
                        endBet: -1,
                        notice: { errorCode: SlotNoticeHelper.invalidJackpot },
                    });
                });

                it("should not settle jackpot", async () => {
                    // Arrange
                    jest.spyOn(consumer, "pickJackpotAndUpdateBet").mockReturnValueOnce({ bet: null, prize: null });
                    jest.spyOn(consumer.jackpotPublisher, "publishToUser");

                    // Act
                    await consumer.consume(mockPlayer, mockPayload);

                    // Assert
                    expect(consumer.settleGameRoundConsumer.settleWithJackpotWin).not.toHaveBeenCalled();
                });
            });

            describe("when bet is found", () => {
                const mockWinningAmount = 1000;
                const mockWinningLine = 5;
                const mockBet = {
                    bet: { playerId: "", id: 123, totalAmount: 2.5, settlementResult: { jackpot: { winningLine: 5, picked: true } } },
                    prize: "minor",
                };

                beforeEach(() => {
                    jest.spyOn(consumer, "pickJackpotAndUpdateBet").mockResolvedValue(mockBet);

                    consumer.settleGameRoundConsumer.processJackpot.mockResolvedValue({
                        winningAmount: mockWinningAmount,
                        winningLine: mockWinningLine,
                    });
                });

                it("should settle game round with jackpot win", async () => {
                    // Arrange
                    const mockWinningAmount = 1000;
                    const settleWithJackpotWinSpy = jest.spyOn(consumer.settleGameRoundConsumer, "settleWithJackpotWin").mockResolvedValue();

                    // Act
                    await consumer.consume(mockPlayer, mockPayload);

                    // Assert
                    expect(settleWithJackpotWinSpy).toHaveBeenCalledWith({
                        roundId: mockBet.bet.id,
                        player: mockPlayer,
                    });
                });
            });
        });
    });

    describe("pickJackpotAndUpdateBet", () => {
        const mockJackpot = { picked: false, prizes: ["minor", "major", "grand"], winningLine: 5 };
        let chanceMock;

        beforeEach(() => {
            consumer.gameData.ingame["player1"] = { finish: { settlementResult: { jackpot: { ...mockJackpot } } } };
            consumer.gameData.ingame["player2"] = { finish: { settlementResult: { jackpot: null } } };

            chanceMock = {
                integer: jest.fn(),
            };
            consumer.chance = chanceMock;
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        describe("when jackpot not exist", () => {
            const player = { profile: { name: "player2" }, session: { playerId: "playerId2" } };

            it("should return bet and prize as NULL", async () => {
                // Act
                const result = await consumer.pickJackpotAndUpdateBet({ player });

                // Assert
                expect(result).toStrictEqual({ bet: null, winningPrize: null });
            });
        });

        describe("when chest value provided", () => {
            const player = { profile: { name: "player1" }, session: { playerId: "playerId1" } };
            const chest = 1;
            const bet = { id: "bet1" };

            it("should use provided chest value and return the correct prize", async () => {
                // Arrange
                roundsRepository.findOneAndUpdate.mockReturnValueOnce(bet);

                // Act
                const result = await consumer.pickJackpotAndUpdateBet({ player, chest });

                // Assert
                expect(result).toEqual({ bet, winningPrize: "major" });
            });

            it("should update the bet with jackpot picked set to true", async () => {
                // Arrange
                roundsRepository.findOneAndUpdate.mockReturnValueOnce(bet);

                // Act
                await consumer.pickJackpotAndUpdateBet({ player, chest });

                // Assert
                expect(roundsRepository.findOneAndUpdate).toHaveBeenCalledWith(
                    { playerId: "playerId1", paid: false, "settlementResult.jackpot.picked": false },
                    { $set: { "settlementResult.jackpot.picked": true, "settlementResult.jackpot.winningPrize": "major" } },
                    { new: true, lean: true }
                );
            });

            it("should set jackpot picked to true in game data", async () => {
                // Arrange
                roundsRepository.findOneAndUpdate.mockReturnValueOnce(bet);

                // Act
                await consumer.pickJackpotAndUpdateBet({ player, chest });

                // Assert
                expect(consumer.gameData.ingame["player1"].finish.settlementResult.jackpot.picked).toBe(true);
            });
        });

        describe("when chest value NOT provided", () => {
            const player = { profile: { name: "player1" }, session: { playerId: "playerId1" } };
            const bet = { id: "bet1" };

            it("should generate chest value if not provided", async () => {
                // Arrange
                const chest = undefined;
                roundsRepository.findOneAndUpdate.mockReturnValueOnce(bet);
                chanceMock.integer.mockReturnValue(2);

                // Act
                await consumer.pickJackpotAndUpdateBet({ player, chest });

                // Assert
                expect(chanceMock.integer).toHaveBeenCalledWith({ min: 0, max: 2 });
            });

            it("should return the correct prize when chest is generated", async () => {
                // Arrange
                const chest = undefined;
                roundsRepository.findOneAndUpdate.mockReturnValueOnce(bet);
                chanceMock.integer.mockReturnValue(2);

                // Act
                const result = await consumer.pickJackpotAndUpdateBet({ player, chest });

                // Assert
                expect(result).toEqual({ bet, winningPrize: "grand" });
            });
        });

        describe("when NO bet is found", () => {
            const player = { profile: { name: "player1" }, session: { playerId: "playerId1" } };
            const chest = 1;

            beforeEach(() => {});

            it("should return null", async () => {
                // Arrange
                roundsRepository.findOneAndUpdate.mockReturnValueOnce(null);

                // Act
                const result = await consumer.pickJackpotAndUpdateBet({ player, chest });

                // Assert
                expect(result).toStrictEqual({ bet: null, winningPrize: null });
            });

            it("should NOT set jackpot picked to true in game data", async () => {
                // Arrange
                roundsRepository.findOneAndUpdate.mockReturnValueOnce(null);

                // Act
                await consumer.pickJackpotAndUpdateBet({ player, chest });

                // Assert
                expect(consumer.gameData.ingame["player1"].finish.settlementResult.jackpot.picked).toBe(false);
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
        const mockJackpot = { picked: false, prizes: ["minor", "major", "grand"], winningLine: 5 };
        const finish = { settlementResult: { jackpot: mockJackpot } };

        beforeEach(() => {
            consumer.gameData.ingame["player1"] = {
                finish,
            };
        });

        it("should return false and publish notice if jackpot is already picked", () => {
            // Arrange
            consumer.gameData.ingame["player1"].finish.settlementResult.jackpot.picked = true;
            jest.spyOn(jackpotPublisher, "publishToUser");

            // Act
            const result = consumer.validate(mockPlayer, 1);

            // Assert
            expect(result).toBe(false);
            expect(jackpotPublisher.publishToUser).toHaveBeenCalledWith("uid1", {
                endBet: -1,
                notice: { errorCode: SlotNoticeHelper.openedJackpot },
            });
        });

        it("should return false and publish notice if chest is invalid", () => {
            // Arrange
            const invalidChest = 3; // Out of bounds
            jest.spyOn(jackpotPublisher, "publishToUser");

            // Act
            const result = consumer.validate(mockPlayer, invalidChest);

            // Assert
            expect(result).toBe(false);
            expect(jackpotPublisher.publishToUser).toHaveBeenCalledWith("uid1", {
                endBet: -1,
                notice: { errorCode: SlotNoticeHelper.invalidJackpot },
            });
        });

        it("should return true if jackpot is NOT picked and chest is valid", () => {
            // Arrange
            const validChest = 1;
            consumer.gameData.ingame["player1"].finish.settlementResult.jackpot.picked = false;
            jest.spyOn(jackpotPublisher, "publishToUser");

            // Act
            const result = consumer.validate(mockPlayer, validChest);

            // Assert
            expect(result).toBe(true);
            expect(jackpotPublisher.publishToUser).not.toHaveBeenCalled();
        });

        it("should handle players not in game data", () => {
            // Arrange
            const newPlayer = { UID: "uid2", profile: { name: "newPlayer" } };
            const chest = 1;
            jest.spyOn(jackpotPublisher, "publishToUser");

            // Act
            const result = consumer.validate(newPlayer, chest);

            // Assert
            expect(result).toBe(false);
            expect(jackpotPublisher.publishToUser).toHaveBeenCalledWith("uid2", {
                endBet: -1,
                notice: { errorCode: SlotNoticeHelper.invalidJackpot },
            });
        });
    });

    describe("processExpired", () => {
        const ingame = {
            bet1: {
                player: { profile: { name: "bet1" } },
                finish: {
                    time: moment.utc().subtract(100, "seconds").toDate(),
                    settlementResult: {
                        jackpot: { winningLine: 3, picked: false, prizes: ["minor", "major", "grand"] },
                    },
                },
            },
            bet2: {
                player: { profile: { name: "bet2" } },
                finish: {
                    time: moment.utc().add(2000, "seconds").toDate(),
                    settlementResult: {
                        jackpot: { winningLine: 2, picked: false, prizes: ["minor", "major", "grand"] },
                    },
                },
            },
            bet3: {
                player: { profile: { name: "bet3" } },
                finish: {
                    time: moment.utc().subtract(50, "seconds").toDate(),
                    settlementResult: {
                        jackpot: { winningLine: 2, picked: false, prizes: ["minor", "major", "grand"] },
                    },
                },
            },
        };

        beforeEach(() => {
            consumer.gameData.ingame = { ...ingame };
        });

        it("should call settleWithJackpotWin for each expired bet", async () => {
            // Arrange
            jest.spyOn(consumer, "pickJackpotAndUpdateBet").mockReturnValue({
                bet: { settlementResult: { jackpot: { winningLine: 3 } } },
                prize: "minor",
            });

            // Act
            await consumer.processExpired();

            // Assert
            expect(settleConsumer.settleWithJackpotWin).toHaveBeenCalledTimes(2);
        });

        it("should call settleWithJackpotWin the correct number of times", async () => {
            // Arrange
            jest.spyOn(consumer, "pickJackpotAndUpdateBet").mockReturnValue({
                bet: { settlementResult: { jackpot: { winningLine: 3 } } },
                prize: "minor",
            });
            settleConsumer.processJackpot.mockReturnValue({ winningAmount: 100, winningLine: 3 });

            // Act
            await consumer.processExpired();

            // Assert
            expect(settleConsumer.settleWithJackpotWin).toHaveBeenCalledTimes(2);
        });

        it("should call settleWithJackpotWin with correct parameters", async () => {
            // Arrange
            const mockBet = { bet: { id: 123, settlementResult: { jackpot: { winningLine: 3 } } }, prize: "minor" };
            jest.spyOn(consumer, "pickJackpotAndUpdateBet").mockReturnValue(mockBet);
            settleConsumer.processJackpot.mockReturnValue({ winningAmount: 100, winningLine: 3 });

            // Act
            await consumer.processExpired();

            // Assert
            expect(settleConsumer.settleWithJackpotWin).toHaveBeenCalledWith({
                roundId: mockBet.bet.id,
                player: { profile: { name: "bet1" } },
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
        jackpotLiveSeconds: 15,
    });
}
