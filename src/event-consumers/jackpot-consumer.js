import math from "lodash/math";
import mongoose from "mongoose";
import { JackpotPublisher } from "./../event-publishers";
import { MultipleCurrencyHelper } from "./../helpers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class JackpotConsumer {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {JackpotPublisher} jackpotPublisher
     * @param {logger} logService
     * @param {mongoose.Model} jackpotsRepository
     * @param {mongoose.Model} currencyGroupGamesRepository
     */
    constructor(definition, gameData, jackpotPublisher, logService, jackpotsRepository, currencyGroupGamesRepository) {
        this.definition = definition;
        this.gameData = gameData;
        this.jackpotPublisher = jackpotPublisher;
        this.logService = logService;
        this.jackpotsRepository = jackpotsRepository;
        this.currencyGroupGamesRepository = currencyGroupGamesRepository;
    }

    async contribute(player, { pool, totalAmount, roundId, rate }) {
        const contributedByMember = !!player.session;
        const basePool = contributedByMember ? this.getBasePool(player, pool) : pool;
        if (basePool == null) {
            this.logService.logCritical(
                `Couldn't find any base jackpot pool associated with: ${JSON.stringify({
                    hasSession: !!player.session,
                    currencyGroupId: player.session?.currencyGroupId,
                    stake: pool,
                })}`
            );
            return;
        }

        const baseTotalAmount = totalAmount * rate;

        const contributionRatio = contributedByMember
            ? this.gameData.gameConfigs.slotsConfig.jackpot.playerContributionRatio
            : this.gameData.gameConfigs.slotsConfig.jackpot.botContributionRatio;
        const contributionAmount = math.round(baseTotalAmount * contributionRatio, 4);

        const runningPoolFilter = {
            pool: basePool,
            winnerName: { $exists: false },
            createdAt: { $lte: roundId },
        };
        const nearestPoolOrder = {
            createdAt: -1,
        };
        const poolAdjustment = {
            amount: contributionAmount,
            byBots: contributedByMember ? 0 : contributionAmount,
            byMembers: contributedByMember ? contributionAmount : 0,
        };
        const latestJackpotProjection = { _id: false, amount: true };
        const latestJackpotPool = await this.jackpotsRepository.findOneAndUpdate(
            runningPoolFilter,
            {
                $inc: poolAdjustment,
            },
            {
                new: true,
                lean: true,
                fields: latestJackpotProjection,
                sort: nearestPoolOrder,
            }
        );

        this.jackpotPublisher.publishLatestPool({ pool: basePool, amount: latestJackpotPool.amount });
    }

    async hit(player, { pool, roundId }) {
        const hitByMember = !!player.session;
        const basePool = hitByMember ? this.getBasePool(player, pool) : pool;
        if (basePool == null) {
            this.logService.logCritical(
                `Couldn't find any base jackpot pool associated with: ${JSON.stringify({
                    hasSession: !!player.session,
                    currencyGroupId: player.session?.currencyGroupId,
                    stake: pool,
                })}`
            );
            return { amount: 0 };
        }

        await this.initializeNewPool(basePool, roundId);

        const winningRatio = this.gameData.gameConfigs.slotsConfig.jackpot.winningRatio;
        const runningPoolFilter = {
            pool: basePool,
            winnerName: { $exists: false },
            createdAt: { $lt: roundId },
        };
        const nearestRunningPoolOrder = {
            createdAt: -1,
        };
        const winnerAdjustment = {
            winningRatio,
            winnerName: player.profile.name,
            winnerId: player.session?.playerId,
            hitAt: roundId,
            hitTime: new Date(),
        };
        const winnerProjection = {
            _id: false,
            pool: true,
            winnerName: true,
            amount: true,
        };
        const winningJackpot = await this.jackpotsRepository.findOneAndUpdate(
            runningPoolFilter,
            {
                $set: winnerAdjustment,
            },
            {
                new: true,
                lean: true,
                fields: winnerProjection,
                sort: nearestRunningPoolOrder,
            }
        );

        if (!winningJackpot) {
            this.logService.logCritical(`Couldn't find any running jackpot pool associated with: ${JSON.stringify(runningPoolFilter)}`);

            return { amount: 0 };
        }

        winningJackpot.amount *= winningRatio;

        await this.jackpotPublisher.publishWinner(player.UID, winningJackpot);

        return winningJackpot;
    }

    async initialize() {
        const stakeLevels = this.gameData.gameConfigs.slotsConfig?.stakeLevels ?? [];
        const roundId = this.gameData.roundId;

        await Promise.all(
            stakeLevels.map(async (stakeLevel) => {
                const runningPoolFilter = {
                    pool: stakeLevel.stake,
                    winnerName: { $exists: false },
                };
                const numberOfExistingPools = await this.jackpotsRepository.countDocuments(runningPoolFilter).exec();

                if (numberOfExistingPools === 0) {
                    await this.initializeNewPool(stakeLevel.stake, roundId);
                }

                if (numberOfExistingPools > 1) {
                    this.logService.logCritical(`Found ${numberOfExistingPools} running jackpot pool for stake level ${stakeLevel.stake}`);
                }
            })
        );
    }

    async initializeNewPool(pool, roundId) {
        const initAmount = this.gameData.gameConfigs.slotsConfig?.stakeLevels?.find((stakeLevel) => stakeLevel.stake === pool)?.jackpot ?? 0;

        this.logService.log(`Init new jackpot pool ${pool} at round ${roundId}`);

        await this.jackpotsRepository.create({
            pool,
            initAmount,
            amount: initAmount,
            createdAt: roundId,
            createdTime: new Date(),
        });
    }

    async getLatestRoundId() {
        const runningPoolFilter = {
            winnerName: { $exists: false },
        };

        const pool = await this.jackpotsRepository
            .findOne(runningPoolFilter, "createdAt", {
                sort: {
                    createdAt: -1,
                },
            })
            .lean()
            .exec();

        return pool ? pool.createdAt : 0;
    }

    getBasePool(player, stake) {
        const { session } = player;
        if (!session) {
            return null;
        }

        const stakeLevels = MultipleCurrencyHelper.getStakeLevels(this.gameData, player);

        const poolIndex = stakeLevels.map((s) => s.stake).indexOf(stake);

        const baseStakeLevels = this.gameData.gameConfigs.slotsConfig?.stakeLevels;

        return poolIndex !== -1 && baseStakeLevels ? baseStakeLevels[poolIndex].stake : null;
    }
}
