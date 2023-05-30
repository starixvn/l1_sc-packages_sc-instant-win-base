import JackpotValidator from "../jackpot-validator";

describe("JackpotValidator", () => {
    describe("canAccessJackpot", () => {
        describe("Jackpot is enabled", () => {
            const gameData = {
                gameConfigs: {
                    slotsConfig: {
                        jackpot: {
                            enabled: true,
                        },
                    },
                },
            };
            it.each([
                [
                    {
                        session: {
                            disableJackpotGames: false,
                        },
                    },
                    true,
                ],
                [
                    {
                        session: {
                            disableJackpotGames: true,
                        },
                    },
                    false,
                ],
            ])("Should return result based on session.disableJackpotGames", (player, expectedResult) => {
                //Arrange
                const validator = new JackpotValidator(gameData);

                //Act
                const result = validator.canAccessJackpot(player);

                //Assert
                expect(result).toStrictEqual(expectedResult);
            });
        });

        describe("Jackpot is disabled", () => {
            const gameData = {
                gameConfigs: {
                    slotsConfig: {
                        jackpot: {
                            enabled: false,
                        },
                    },
                },
            };

            it.each([
                {
                    session: {
                        disableJackpotGames: false,
                    },
                },
                {
                    session: {
                        disableJackpotGames: true,
                    },
                },
            ])("should always return false", (player) => {
                //Arrange
                const validator = new JackpotValidator(gameData);

                //Act
                const result = validator.canAccessJackpot(player);

                //Assert
                expect(result).toBeFalse();
            });
        });
    });
    describe("canContributeJackpotPools", () => {
        describe("Jackpot is enabled", () => {
            const gameData = {
                gameConfigs: {
                    slotsConfig: {
                        jackpot: {
                            enabled: true,
                        },
                    },
                },
                currencies: [],
            };
            const player = {
                session: {
                    disableJackpotGames: false,
                },
            };

            it("Should return false when freeSpin is true", () => {
                //Arrange
                const validator = new JackpotValidator(gameData);

                //Act
                const result = validator.canContributeJackpotPools(player, true);

                //Assert
                expect(result).toBeFalse();
            });

            it("Should return true when freeSpin is false", () => {
                //Arrange
                const validator = new JackpotValidator(gameData);

                //Act
                const result = validator.canContributeJackpotPools(player, false);

                //Assert
                expect(result).toBeTrue();
            });

            describe("user with test currency", () => {
                const player = {
                    session: {
                        disableJackpotGames: false,
                        currencyName: "UUS",
                    },
                };

                it.each([true, false])("Should return correctly based on excludeTestCurrency", (excludeTestCurrency) => {
                    //Arrange
                    const gameData = {
                        gameConfigs: {
                            slotsConfig: {
                                jackpot: {
                                    enabled: true,
                                    excludeTestCurrency,
                                },
                            },
                        },
                        currencies: [{ name: "UUS", isTest: true }],
                    };
                    const validator = new JackpotValidator(gameData);

                    //Act
                    const result = validator.canContributeJackpotPools(player, false);

                    //Assert
                    expect(result).toStrictEqual(!excludeTestCurrency);
                });
            });
        });

        describe("Jackpot is disabled", () => {
            const gameData = {
                gameConfigs: {
                    slotsConfig: {
                        jackpot: {
                            enabled: false,
                        },
                    },
                },
            };

            it.each([
                {
                    session: {
                        disableJackpotGames: false,
                    },
                },
                {
                    session: {
                        disableJackpotGames: true,
                    },
                },
            ])("should always return false", (player) => {
                //Arrange
                const validator = new JackpotValidator(gameData);

                //Act
                const result = validator.canContributeJackpotPools(player, false);

                //Assert
                expect(result).toBeFalse();
            });

            
            describe("user with test currency", () => {
                const player = {
                    session: {
                        disableJackpotGames: false,
                        currencyName: "UUS",
                    },
                };

                it.each([true, false])("Should return correctly based on excludeTestCurrency", (excludeTestCurrency) => {
                    //Arrange
                    const gameData = {
                        gameConfigs: {
                            slotsConfig: {
                                jackpot: {
                                    enabled: true,
                                    excludeTestCurrency,
                                },
                            },
                        },
                        currencies: [{ name: "UUS", isTest: true }],
                    };
                    const validator = new JackpotValidator(gameData);

                    //Act
                    const result = validator.canHitJackpot(player);

                    //Assert
                    expect(result).toStrictEqual(!excludeTestCurrency);
                });
            });
        });
    });
    describe("canHitJackpot", () => {
        describe("Jackpot is enabled", () => {
            const gameData = {
                gameConfigs: {
                    slotsConfig: {
                        jackpot: {
                            enabled: true,
                        },
                    },
                },
            };
            it.each([
                [
                    {
                        session: {
                            disableJackpotGames: false,
                        },
                    },
                    true,
                ],
                [
                    {
                        session: {
                            disableJackpotGames: true,
                        },
                    },
                    false,
                ],
            ])("Should return result based on session.disableJackpotGames", (player, expectedResult) => {
                //Arrange
                const validator = new JackpotValidator(gameData);

                //Act
                const result = validator.canAccessJackpot(player);

                //Assert
                expect(result).toStrictEqual(expectedResult);
            });
        });

        describe("Jackpot is disabled", () => {
            const gameData = {
                gameConfigs: {
                    slotsConfig: {
                        jackpot: {
                            enabled: false,
                        },
                    },
                },
            };

            it.each([
                {
                    session: {
                        disableJackpotGames: false,
                    },
                },
                {
                    session: {
                        disableJackpotGames: true,
                    },
                },
            ])("should always return false", (player) => {
                //Arrange
                const validator = new JackpotValidator(gameData);

                //Act
                const result = validator.canHitJackpot(player);

                //Assert
                expect(result).toBeFalse();
            });
        });
    });
});
