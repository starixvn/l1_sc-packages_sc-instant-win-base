import mongoose from "mongoose";
import { Core } from "sc-game-base";

import { MultipleCurrencyHelper } from "./../helpers";
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
        jackpotValidator,
    }) {
        super(definition, gameData, roundQuery, publisher, getBalance, userInfosRepository);

        this.freeSpinsConsumer = freeSpinsConsumer;
        this.jackpotsRepository = jackpotsRepository;
        this.jackpotValidator = jackpotValidator;
    }

    async buildPayload(realPlayer) {
        const { session } = realPlayer;

        const gameConfigs = this.getSlotGameConfig(realPlayer);
        const freeSpins = this.getAvailableFreeSpins(realPlayer);
        const jackpotPools = this.jackpotValidator.canAccessJackpot(realPlayer) ? await this.getPools() : [];

        await this.getBalance(realPlayer, true);

        const user = await this.getUserInfo(realPlayer.UID);

        const { rate, multiplier } = this.getExchangeRate(session);

        return {
            gameConfigs,
            jackpotPools,
            freeSpins,
            user: {
                ...user,
                rate,
                multiplier,
                disableJackpotGames: session.disableJackpotGames,
            },
        };
    }

    getSlotGameConfig(realPlayer) {
        const betLevels = MultipleCurrencyHelper.getBetLevels(this.gameData, realPlayer);
        const { icons: odds, jackpot, betLevels: baseBetLevels } = this.gameData.gameConfigs.slotsConfig;

        const poolConfigs = this.getJackpotPoolsConfig(jackpot.pools);

        return {
            baseBetLevels,
            betLevels,
            odds,
            jackpot: {
                winningRatio: jackpot.winningRatio,
                pools: poolConfigs,
            },
        };
    }

    getJackpotPoolsConfig(pools) {
        const poolConfigs = [];

        Object.keys(pools).forEach((prize) => {
            const config = { pool: prize, contribute: pools[prize].contribute };
            poolConfigs.push(config);
        });

        return poolConfigs;
    }

    getAvailableFreeSpins(realPlayer) {
        const totalOfFreeSpins = this.freeSpinsConsumer.getTotalAvaiableFreeSpins(realPlayer);
        const soonestExpiredFreeSpinSet = this.freeSpinsConsumer.getSoonestExpiredFreeSpinSet(realPlayer) ?? { bet: 0, paylines: [] };

        return {
            total: totalOfFreeSpins,
            bet: soonestExpiredFreeSpinSet.bet,
            paylines: soonestExpiredFreeSpinSet.paylines,
        };
    }

    async getPools() {
        const runningPoolsFilter = {
            gameId: this.definition.id,
            winnerName: { $exists: false },
        };
        const projection = {
            _id: false,
            pool: "$prize",
            amount: true,
        };

        return this.jackpotsRepository.find(runningPoolsFilter, projection).lean().exec();
    }

    getExchangeRate(session) {
        const { exchangeRates } = this.gameData;
        const { multiplier, currencyCode } = session;
        //TODO what if exchangeRates.code[currencyCode] is undefined?!?
        const rate = exchangeRates.code[currencyCode] * multiplier;

        return { rate, multiplier };
    }
}
