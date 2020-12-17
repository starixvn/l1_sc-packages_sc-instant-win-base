import { JackpotPublisher } from "./../event-publishers";
import { Jackpots } from "./../models";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class JackpotConsumer {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
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

        await this.jackpotPublisher.publishWinner(winningJackpot);

        return winningJackpot;
    }

    async initialize() {
        const stakeLevels = this.gameData.gameConfigs.slotsConfig?.stakeLevels ?? [];
        const roundId = this.gameData.roundId;

        await Promise.all(
            stakeLevels.map(async (stakeLevel) => {
                const runningPoolFilter = {
                    game: this.definition.name,
                    pool: stakeLevel.stake,
                    winnerName: { $exists: false },
                    createdAt: { $lte: roundId },
                };
                const numberOfExistingPools = await Jackpots.countDocuments(runningPoolFilter).exec();

                if (numberOfExistingPools === 0) {
                    await this.initializeNewPool(stakeLevel.stake, roundId);
                }
            })
        );
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
