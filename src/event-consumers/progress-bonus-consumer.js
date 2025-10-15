import Chance from "chance";
import math from "lodash/math";

import { BonusPublisher } from "./../event-publishers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class ProgressBonusConsumer {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {BonusPublisher} bonusPublisher
     * @param {mongoose.Model} dependencies.roundsRepository
     * @param {mongoose.Model} dependencies.progressBonusRepository
     * @param {logger} dependencies.logService
     * @param {Object} config - Configuration object
     */
    constructor(definition, gameData, bonusPublisher, roundsRepository, progressBonusRepository, logService, config = {}) {
        this.definition = definition;
        this.gameData = gameData;
        this.bonusPublisher = bonusPublisher;
        this.roundsRepository = roundsRepository;
        this.progressBonusRepository = progressBonusRepository;
        this.logService = logService;

        this.chance = new Chance();

        this.BETS_TRIGGER_THRESHOLD = config.betsTriggerThreshold || 200;
        this.BASE_BONUS_PERCENTAGE = config.baseBonusPercentage || 0.01;
        this.MIN_BONUS_AMOUNT = config.minBonusAmount || 1;
        this.MAX_BONUS_AMOUNT = config.maxBonusAmount || 10000;
        this.DATABASE_RETRY_ATTEMPTS = config.databaseRetryAttempts || 3;
        this.DATABASE_RETRY_DELAY = config.databaseRetryDelay || 1000;

        this.MULTIPLIERS = config.multipliers || [3, 5, 20, 50, 500];
        this.MULTIPLIER_WEIGHTS = config.multiplierWeights || [0.4, 0.3, 0.2, 0.08, 0.02];

        this.TIMEOUT_DURATION = 3000;
        this.DECREASE_INTERVAL = 150;

        this.metrics = {
            betsTracked: 0,
            bonusesAwarded: 0,
            totalBonusAmount: 0,
            errors: 0,
        };
    }

    /**
     * Track bet count for user and trigger progress bonus if threshold reached
     * @param {Object} player - Player object
     * @param {Number} betAmount - Bet amount for this round
     * @param {Number} roundId - Round ID
     * @param {Boolean} isFreeSpin - Whether this is a free spin bet
     */
    async trackBetAndCheckProgressBonus(player, betAmount, roundId, isFreeSpin = false) {
        if (!this.validateInputs(player, betAmount, roundId)) {
            return;
        }

        const playerName = player.profile.name;
        const now = new Date();

        await this.initializePlayerProgress(playerName);
        const progressData = this.gameData.ingame[playerName].progressBonus;

        this.calculateBetCount(playerName, progressData, now);
        this.updateBetAmount(progressData, betAmount, isFreeSpin);

        progressData.lastTapTime = now;

        await this.saveProgressToDatabase(playerName, progressData);

        this.publishProgressUpdate(player);

        if (this.isThresholdReached(progressData.betCount)) {
            this.triggerProgressBonus(player, progressData.totalBetAmount, roundId);
            await this.resetProgress(playerName, roundId);
        }

        this.metrics.betsTracked++;
    }

    /**
     * Validate input parameters
     * @param {Object} player - Player object
     * @param {Number} betAmount - Bet amount
     * @param {Number} roundId - Round ID
     */
    validateInputs(player, betAmount, roundId) {
        return player?.profile?.name && betAmount >= 0 && roundId > 0;
    }

    async initializePlayerProgress(playerName) {
        if (!this.gameData.ingame[playerName]) {
            this.gameData.ingame[playerName] = {};
        }

        if (!this.gameData.ingame[playerName].progressBonus) {
            const savedProgress = await this.loadProgressFromDatabase(playerName);
            this.gameData.ingame[playerName].progressBonus = savedProgress || {
                betCount: 0,
                totalBetAmount: 0,
                lastBonusRoundId: null,
                lastTapTime: null,
                isDecreasing: false,
                decreaseStartTime: null,
            };
        }
    }

    calculateBetCount(playerName, progressData, now) {
        try {
            if (progressData.isDecreasing) {
                const timeSinceStart = now.getTime() - progressData.decreaseStartTime.getTime();
                const decreaseAmount = Math.floor(timeSinceStart / this.DECREASE_INTERVAL);
                const newBetCount = Math.max(0, progressData.betCount - decreaseAmount);

                progressData.betCount = newBetCount;
                progressData.isDecreasing = false;
                progressData.decreaseStartTime = null;
            }

            progressData.betCount++;
        } catch (error) {
            this.logService.logError(error);
        }
    }

    updateBetAmount(progressData, betAmount, isFreeSpin) {
        if (!isFreeSpin) {
            progressData.totalBetAmount += betAmount;
        }
    }

    isThresholdReached(betCount) {
        return betCount >= this.BETS_TRIGGER_THRESHOLD;
    }

    async resetProgress(playerName, roundId) {
        const progressData = this.gameData.ingame[playerName].progressBonus;
        progressData.betCount = 0;
        progressData.totalBetAmount = 0;
        progressData.lastBonusRoundId = roundId;
        await this.saveProgressToDatabaseWithRetry(playerName, progressData);
    }

    /**
     * Trigger progress bonus game
     * @param {Object} player - Player object
     * @param {Number} totalBetAmount - Total bet amount for bonus calculation
     * @param {Number} roundId - Current round ID
     */
    async triggerProgressBonus(player, totalBetAmount, roundId) {
        const playerName = player.profile.name;
        const bonusCalculation = this.calculateBonusAmount(totalBetAmount);
        const bonusGameData = this.createBonusGameData(bonusCalculation, roundId, totalBetAmount);

        this.storeBonusGameData(playerName, bonusGameData);
        this.awardProgressBonus(player, bonusGameData);

        this.metrics.bonusesAwarded++;
        this.metrics.totalBonusAmount += bonusCalculation.finalAmount;
    }

    calculateBonusAmount(totalBetAmount) {
        const baseBonusAmount = math.round(totalBetAmount * this.BASE_BONUS_PERCENTAGE, 2);
        const selectedMultiplier = this.chance.weighted(this.MULTIPLIERS, this.MULTIPLIER_WEIGHTS);
        let finalBonusAmount = math.round(baseBonusAmount * selectedMultiplier, 2);

        finalBonusAmount = Math.min(Math.max(finalBonusAmount, this.MIN_BONUS_AMOUNT), this.MAX_BONUS_AMOUNT);

        return {
            baseAmount: baseBonusAmount,
            multiplier: selectedMultiplier,
            finalAmount: finalBonusAmount,
        };
    }

    createBonusGameData(bonusCalculation, roundId, totalBetAmount) {
        return {
            type: "progress_bonus",
            baseAmount: bonusCalculation.baseAmount,
            multiplier: bonusCalculation.multiplier,
            finalAmount: bonusCalculation.finalAmount,
            roundId: roundId,
            triggeredAt: new Date(),
            totalBets: totalBetAmount,
        };
    }

    storeBonusGameData(playerName, bonusGameData) {
        this.gameData.ingame[playerName].progressBonusGame = bonusGameData;
    }

    /**
     * Publish progress update to player
     * @param {Object} player - Player object
     */
    publishProgressUpdate(player) {
        try {
            const status = this.getProgressBonusStatus(player);

            this.bonusPublisher.publishProgressBonus(player.UID, {
                progressBonus: status,
            });
        } catch (error) {
            this.metrics.errors++;
            this.logService.logError(error);
        }
    }

    publishCountdownStart(playerName, progressData) {
        try {
            const player = this.getPlayerFromGameData(playerName);
            if (!player) {
                return;
            }

            this.bonusPublisher.publishProgressBonus(player.UID, {
                progressBonusCountdown: {
                    betCount: progressData.betCount,
                    totalBetAmount: progressData.totalBetAmount,
                    isDecreasing: true,
                },
            });
        } catch (error) {
            this.logService.logError(error);
        }
    }

    /**
     * Award progress bonus to player
     * @param {Object} player - Player object
     * @param {Object} bonusGameData - Bonus game data
     */
    awardProgressBonus(player, bonusGameData) {
        this.publishBonusAward(player, bonusGameData);
        this.cleanupBonusGameData(player.profile.name);
    }

    publishBonusAward(player, bonusGameData) {
        this.bonusPublisher.publishProgressBonusAward(player.UID, {
            progressBonusAward: {
                amount: bonusGameData.finalAmount,
                baseAmount: bonusGameData.baseAmount,
                multiplier: bonusGameData.multiplier,
                roundId: bonusGameData.roundId,
            },
        });
    }

    cleanupBonusGameData(playerName) {
        delete this.gameData.ingame[playerName].progressBonusGame;
    }

    /**
     * Get progress bonus status for player
     * @param {Object} player - Player object
     * @returns {Object} - Progress bonus status
     */
    getProgressBonusStatus(player) {
        const playerName = player.profile.name;
        const progressData = this.getPlayerProgressData(playerName);

        return progressData ? this.createProgressStatus(progressData) : this.createDefaultProgressStatus();
    }

    getPlayerProgressData(playerName) {
        return this.gameData.ingame[playerName]?.progressBonus;
    }

    createDefaultProgressStatus() {
        return {
            betCount: 0,
            totalBetAmount: 0,
            remainingBets: this.BETS_TRIGGER_THRESHOLD,
            progressPercentage: 0,
            lastTapTime: null,
            isDecreasing: false,
            decreaseStartTime: null,
        };
    }

    createProgressStatus(progressData) {
        return {
            betCount: progressData.betCount,
            totalBetAmount: progressData.totalBetAmount,
            remainingBets: this.calculateRemainingBets(progressData.betCount),
            progressPercentage: this.calculateProgressPercentage(progressData.betCount),
            lastBonusRoundId: progressData.lastBonusRoundId,
            lastTapTime: progressData.lastTapTime,
            isDecreasing: progressData.isDecreasing,
            decreaseStartTime: progressData.decreaseStartTime,
        };
    }

    calculateRemainingBets(betCount) {
        return Math.max(0, this.BETS_TRIGGER_THRESHOLD - betCount);
    }

    calculateProgressPercentage(betCount) {
        return Math.min(100, (betCount / this.BETS_TRIGGER_THRESHOLD) * 100);
    }

    /**
     * Reset progress bonus for player (for testing or admin purposes)
     * @param {Object} player - Player object
     */
    async resetProgressBonus(player) {
        const playerName = player.profile.name;
        if (!this.hasProgressData(playerName)) return;

        this.resetPlayerProgress(playerName);
        await this.saveProgressToDatabaseWithRetry(playerName, this.gameData.ingame[playerName].progressBonus);
    }

    hasProgressData(playerName) {
        return this.gameData.ingame[playerName]?.progressBonus;
    }

    resetPlayerProgress(playerName) {
        this.gameData.ingame[playerName].progressBonus = {
            betCount: 0,
            totalBetAmount: 0,
            lastBonusRoundId: null,
        };
    }

    /**
     * Save progress to database with retry mechanism
     * @param {String} playerName - Player name
     * @param {Object} progressData - Progress data
     */
    async saveProgressToDatabaseWithRetry(playerName, progressData) {
        for (let attempt = 1; attempt <= this.DATABASE_RETRY_ATTEMPTS; attempt++) {
            try {
                await this.saveProgressToDatabase(playerName, progressData);
                return; // Success
            } catch (error) {
                if (attempt === this.DATABASE_RETRY_ATTEMPTS) {
                    throw error;
                }

                const delay = this.DATABASE_RETRY_DELAY * Math.pow(2, attempt - 1);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    async saveProgressToDatabase(playerName, progressData) {
        const player = this.getPlayerFromGameData(playerName);
        if (!player) {
            throw new Error(`Player not found in game data: ${playerName}`);
        }

        const filter = {
            playerId: player.session.playerId,
            operatorId: player.session.operatorId,
        };

        const update = {
            uid: player.UID,
            name: playerName,
            currency: player.session.currencyName,
            totalBetAmount: progressData.totalBetAmount,
            lastBonusRoundId: progressData.lastBonusRoundId,
            lastTapTime: progressData.lastTapTime,
            isDecreasing: progressData.isDecreasing,
            decreaseStartTime: progressData.decreaseStartTime,
            updatedAt: new Date(),
        };

        await this.progressBonusRepository.findOneAndUpdate(filter, { $set: update }, { upsert: true, new: true });
    }

    async loadProgressFromDatabase(playerName) {
        try {
            const player = this.getPlayerFromGameData(playerName);
            if (!player) return null;

            const filter = {
                playerId: player.session.playerId,
                operatorId: player.session.operatorId,
            };

            const savedProgress = await this.progressBonusRepository.findOne(filter).lean();

            return savedProgress
                ? {
                      betCount: 0,
                      totalBetAmount: savedProgress.totalBetAmount,
                      lastBonusRoundId: savedProgress.lastBonusRoundId,
                      lastTapTime: savedProgress.lastTapTime,
                      isDecreasing: savedProgress.isDecreasing || false,
                      decreaseStartTime: savedProgress.decreaseStartTime,
                  }
                : null;
        } catch (error) {
            this.metrics.errors++;
            this.logService.logError(error);
            return null;
        }
    }

    getPlayerFromGameData(playerName) {
        const ingameData = this.gameData.ingame[playerName];
        return ingameData?.player || null;
    }

    processCountdown() {
        try {
            const timeoutThreshold = new Date(Date.now() - this.TIMEOUT_DURATION);

            for (const playerName in this.gameData.ingame) {
                const playerData = this.gameData.ingame[playerName];
                const progressData = playerData?.progressBonus;

                if (progressData?.betCount > 0 && progressData.lastTapTime <= timeoutThreshold && !progressData.isDecreasing) {
                    this.processCountdownStart(playerName, progressData);
                }
            }
        } catch (error) {
            this.logService.logError(error);
        }
    }

    processCountdownStart(playerName, progressData) {
        try {
            progressData.isDecreasing = true;
            progressData.decreaseStartTime = new Date();
            this.publishCountdownStart(playerName, progressData);
        } catch (error) {
            this.logService.logError(error);
        }
    }

    async initialize() {
        try {
            const allProgress = await this.progressBonusRepository.find({}).lean();

            for (const progress of allProgress) {
                const playerName = progress.name;
                if (!this.gameData.ingame[playerName]) {
                    this.gameData.ingame[playerName] = {};
                }

                this.gameData.ingame[playerName].progressBonus = {
                    betCount: 0,
                    totalBetAmount: progress.totalBetAmount,
                    lastBonusRoundId: progress.lastBonusRoundId,
                    lastTapTime: progress.lastTapTime,
                    isDecreasing: progress.isDecreasing || false,
                    decreaseStartTime: progress.decreaseStartTime,
                };
            }
        } catch (error) {
            this.metrics.errors++;
            this.logService.logError(error);
        }
    }
}
