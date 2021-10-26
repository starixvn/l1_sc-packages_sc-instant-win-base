import { getBalance as getBalanceApi } from "sc-base-apis";
import { Core } from "sc-game-base";

import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
import FreeSpinsConsumer from "./free-spins-consumer";

export default class InGameConsumer extends Core.BaseEventConsumers.InGameConsumer {
    /**
     * @param {Object} dependencies
     * @param {SlotGameDefinition} dependencies.definition
     * @param {SlotGameData} dependencies.gameData
     * @param {Core.QueryApis.RoundQuery} dependencies.roundQuery
     * @param {Core.BaseEventPublishers.BaseEventPublisher} dependencies.publisher
     * @param {FreeSpinsConsumer} dependencies.freeSpinsConsumer
     * @param {getBalanceApi} dependencies.getBalance
     * @param {mongoose.Model} dependencies.userInfosRepository
     * @param {mongoose.Model} dependencies.jackpotsRepository
     * @param {mongoose.Model} dependencies.currencyGroupGamesRepository
     */
    constructor({
        definition,
        gameData,
        roundQuery,
        publisher,
        freeSpinsConsumer,
        getBalance,
        userInfosRepository,
        jackpotsRepository,
        currencyGroupGamesRepository,
    }) {
        super(definition, gameData, roundQuery, publisher, getBalance, userInfosRepository, currencyGroupGamesRepository);

        this.freeSpinsConsumer = freeSpinsConsumer;
        this.jackpotsRepository = jackpotsRepository;
    }

    async buildPayload(realPlayer) {
        const { session } = realPlayer;
        const stakeLevels =
            (await this.currencyGroupGamesRepository.findOne({ groupId: session.currencyGroupId }, "stakeLevels").lean().exec()) ?? [];

        const { icons: odds, jackpot } = this.gameData.gameConfigs.slotsConfig;
        const gameConfigs = {
            stakeLevels: stakeLevels.map((level) => level.stake),
            odds,
            jackpot: {
                winningRatio: jackpot.winningRatio,
            },
        };
        const totalOfFreeSpins = this.freeSpinsConsumer.getTotalAvaiableFreeSpins(realPlayer);
        const soonestExpiredFreeSpinSet = this.freeSpinsConsumer.getSoonestExpiredFreeSpinSet(realPlayer);
        const freeSpins = {
            total: totalOfFreeSpins,
            bet: soonestExpiredFreeSpinSet?.bet,
            paylines: soonestExpiredFreeSpinSet?.paylines,
        };
        const jackpotPools = await this.getPools();

        await this.getBalance(realPlayer, true);

        const user = await this.getUserInfo(realPlayer.UID);

        return {
            gameConfigs,
            jackpotPools,
            freeSpins,
            user,
        };
    }

    async getPools() {
        const runningPoolsFilter = {
            gameId: this.definition.id,
            winnerName: { $exists: false },
        };
        const projection = {
            _id: false,
            pool: true,
            amount: true,
        };

        return this.jackpotsRepository.find(runningPoolsFilter, projection).lean().exec();
    }
}
