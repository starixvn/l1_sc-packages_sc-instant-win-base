import mongoose from "mongoose";
import { Core, Table } from "sc-game-base";

import defaultDefinition from "../board/default-definition";
import { MultipleCurrencyHelper } from "./../helpers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
import FreeSpinsConsumer from "./free-spins-consumer";

export default class InGameConsumer extends Table.EventConsumers.TableInGameConsumer {
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
        boardDefinition,
    }) {
        super(definition, gameData, roundQuery, publisher, getBalance, userInfosRepository);

        this.freeSpinsConsumer = freeSpinsConsumer;
        this.jackpotsRepository = jackpotsRepository;
        this.jackpotValidator = jackpotValidator;
        this.boardDefinition = boardDefinition ?? defaultDefinition;
    }

    async buildPayload(realPlayer) {
        const { session } = realPlayer;
        const canAccessJackpot = this.jackpotValidator.canAccessJackpot(realPlayer);
        console.log("canAccessJackpot", canAccessJackpot);
        const gameConfigs = this.getSlotGameConfig(realPlayer, canAccessJackpot);
        const freeSpins = this.getAvailableFreeSpins(realPlayer);
        const jackpotPools = canAccessJackpot ? await this.getPools() : [];

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

    getSlotGameConfig(realPlayer, canAccessJackpot) {
        const betLevels = MultipleCurrencyHelper.getBetLevels(this.gameData, realPlayer).map((x) => x * this.boardDefinition.paylines.length);
        const defaultBetLevel = MultipleCurrencyHelper.getDefaultBetLevel(this.gameData, realPlayer) * this.boardDefinition.paylines.length;
        const { icons: odds, jackpot } = this.gameData.gameConfigs.slotsConfig;

        return {
            betLevels,
            defaultBetLevel,
            odds,
            jackpot: canAccessJackpot
                ? {
                      winningRatio: jackpot.winningRatio,
                      pools: this.getJackpotPoolsConfig(jackpot.pools),
                  }
                : {},
        };
    }

    getJackpotPoolsConfig(pools) {
        const poolConfigs = [];

        Object.keys(pools).forEach((prize) => {
            const config = { pool: prize, contribute: pools[prize].playerSettings.contrib };
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
        const rate = exchangeRates.code[currencyCode] * multiplier;

        return { rate, multiplier };
    }
}
