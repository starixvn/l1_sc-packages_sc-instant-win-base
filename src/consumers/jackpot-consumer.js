import { Core } from "sc-game-base";

import Jackpots from "./../models/jackpots";
import JackpotPublisher from "./../publishers/jackpot-publisher";

export default class JackpotConsumer {
    /**
     * @param {Core.GameDefinition} definition
     * @param {Core.GameData} gameData
     * @param {JackpotPublisher} jackpotPublisher
     */
    constructor(definition, gameData, jackpotPublisher = null) {
        this.definition = definition;
        this.gameData = gameData;
        this.jackpotPublisher = jackpotPublisher ?? new JackpotPublisher(definition.name, gameData);
    }

    async contribute(player, { pool, totalAmount, roundId }) {
        const contributedByMember = !!player.session;
        const contributionRatio = contributedByMember
            ? this.gameData.gameConfigs.slotsConfig.jackpot.playerContributionRatio
            : this.gameData.gameConfigs.slotsConfig.jackpot.botContributionRatio;
        const contributionAmount = totalAmount * contributionRatio;

        const runningPoolFilter = {
            game: this.definition.name,
            pool,
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
        const latestJackpotPool = await Jackpots.findOneAndUpdate(
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

        this.jackpotPublisher.publishLatestPool({ pool, amount: latestJackpotPool.amount });
    }

    async hit(player, { pool, roundId }) {
        await this.initializeNewPool(pool, roundId);

        const winningRatio = this.gameData.gameConfigs.slotsConfig.jackpot.winningAmount;
        const runningPoolFilter = {
            game: this.definition.name,
            pool,
            createdAt: { $lt: roundId },
        };
        const nearestRunningPoolOrder = {
            createdAt: -1,
        };
        const winnerAdjustment = {
            winningRatio,
            winnerName: player.profile.name,
            winnerId: player.session?.memberId,
            hitAt: roundId,
            hitTime: new Date(),
        };
        const winnerProjection = {
            _id: false,
            pool: true,
            winnerName: true,
            amount: true,
        };
        const winningJackpot = await Jackpots.findOneAndUpdate(
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

        winningJackpot.amount *= winningRatio;

        this.jackpotPublisher.publishWinner(winningJackpot);

        return winningJackpot;
    }

    async initializeNewPool(pool, roundId) {
        const initAmount = this.gameData.gameConfigs.slotsConfig?.stakeLevels?.find((stakeLevel) => stakeLevel.stake === pool)?.jackpot ?? 0;

        await Jackpots.create({
            game: this.definition.name,
            pool,
            initAmount,
            createdAt: roundId,
            createdTime: new Date(),
        });
    }
}
