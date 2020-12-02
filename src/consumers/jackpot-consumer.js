import { Core } from "sc-game-base";

import Jackpot from "./../models/jackpot";
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
        this.jackpotPublisher = jackpotPublisher;
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
            createdAt: { $gte: roundId },
        };
        const poolAdjustment = {
            amount: contributionAmount,
            byBots: contributedByMember ? 0 : contributionAmount,
            byMembers: contributedByMember ? contributionAmount : 0,
        };
        const newPoolInitiations = {
            createdAt: roundId,
            createdTime: new Date(),
        };
        const latestJackpotProjection = { _id: false, amount: true };
        const latestJackpotPool = await Jackpot.findOneAndUpdate(
            runningPoolFilter,
            {
                $inc: poolAdjustment,
                $setOnInsert: newPoolInitiations,
            },
            {
                upsert: true,
                setDefaultsOnInsert: true,
                new: true,
                lean: true,
                projection: latestJackpotProjection,
            }
        );

        this.jackpotPublisher.publishLatestPool({ pool, amount: latestJackpotPool.amount });
    }

    async hit(player, { pool, totalAmount, roundId }) {
        await this.initializeNewPool(pool, roundId);

        const runningPoolFilter = {
            game: this.definition.name,
            pool,
            createdAt: { $lt: roundId },
        };
        const winnerAdjustment = {
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
        const winningJackpot = await Jackpot.findOneAndUpdate(
            runningPoolFilter,
            {
                $set: winnerAdjustment,
            },
            {
                new: true,
                lean: true,
                projection: winnerProjection,
            }
        );

        // TODO: need to correct the field name of rTP?
        winningJackpot.amount *= this.gameData.gameConfigs.slotsConfig.jackpot.rTP;

        this.jackpotPublisher.publishWinner(winningJackpot);
        await this.contribute(player, { pool, totalAmount, roundId });

        return winningJackpot;
    }

    async initializeNewPool(pool, roundId) {
        const initAmount = this.gameData.gameConfigs.slotsConfig?.stakeLevels?.find((stakeLevel) => stakeLevel.stake === pool)?.jackpot ?? 0;

        await Jackpot.create({
            game: this.definition.name,
            pool,
            initAmount,
            createdAt: roundId,
            createdTime: new Date(),
        });
    }
}
