import mongoose from "mongoose";
import { Core } from "sc-game-base";

import math from "lodash/math";
import defaultDefinition from "../board/default-definition";
import { JackpotPrizeGenerator } from "./../board";
import { JackpotPublisher } from "./../event-publishers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
import FreeSpinsConsumer from "./free-spins-consumer";
import GenerateResultConsumer from "./generate-result-consumer";
import HallOfFameConsumer from "./hall-of-fame-consumer";
import JackpotConsumer from "./jackpot-consumer";

export default class SettleGameRoundConsumer extends Core.BaseEventConsumers.SettleGameRoundConsumer {
    /**
     * @param {Object} dependencies
     * @param {SlotGameDefinition} dependencies.definition
     * @param {SlotGameData} dependencies.gameData
     * @param {Core.BaseEventPublisher.RoundResultPublisher} dependencies.roundResultPublisher
     * @param {Core.BaseEventPublisher.UserBetResultPublisher} dependencies.userBetResultPublisher
     * @param {JackpotPublisher} dependencies.jackpotPublisher
     * @param {FreeSpinsConsumer} dependencies.freeSpinsConsumer
     * @param {HallOfFameConsumer} dependencies.hallOfFameConsumer
     * @param {JackpotConsumer} dependencies.jackpotConsumer
     * @param {endGameApi} endGame
     * @param {hitJackpotApi} hitJackpot
     * @param {mongoose.Model} dependencies.roundsRepository
     * @param {mongoose.Model} dependencies.betsRepository
     * @param {JackpotPrizeGenerator} dependencies.jackpotPrizeGenerator
     * @param {GenerateResultConsumer} dependencies.generateResultConsumer
     */

    constructor({
        definition,
        gameData,
        roundResultPublisher,
        userBetResultPublisher,
        jackpotPublisher,
        freeSpinsConsumer,
        hallOfFameConsumer,
        jackpotConsumer,
        endGame,
        hitJackpot,
        roundsRepository,
        betsRepository,
        logService,
        jackpotPrizeGenerator,
        generateResultConsumer,
        boardDefinition,
    }) {
        super({
            definition,
            gameData,
            roundResultPublisher,
            userBetResultPublisher,
            endGame,
            roundsRepository,
            betsRepository,
        });

        this.jackpotPublisher = jackpotPublisher;
        this.freeSpinsConumer = freeSpinsConsumer;
        this.hallOfFameConsumer = hallOfFameConsumer;
        this.jackpotConsumer = jackpotConsumer;
        this.hitJackpot = hitJackpot;
        this.logService = logService;
        this.jackpotPrizeGenerator = jackpotPrizeGenerator;
        this.generateResultConsumer = generateResultConsumer;
        this.boardDefinition = boardDefinition ?? defaultDefinition;
    }

    async autoSettleRound(player, roundId) {
        if (!this.gameData.ingame[player.profile.name].finish) {
            return;
        }

        const bet = await this.queryBets(roundId);

        const { bonusChests, finish } = this.gameData.ingame[player.profile.name];

        await this.settleBets(
            player,
            finish,
            bet,
            bonusChests.filter((chest) => chest.picked)
        );
    }

    async settleRound(player, roundId) {
        const bet = await this.queryBets(roundId);

        if (bet) {
            const finish = await this.generateRoundResult(player, roundId, bet);
            const { settlementResult } = finish;
            await this.processFreeSpins(player, bet, settlementResult);
            this.updateBetTrack(player, finish);

            if (settlementResult.jackpot && settlementResult.jackpot.prizes?.length > 0) {
                await this.publishJackpotPrize({ finish, prizes: settlementResult.jackpot.prizes, bet });
                return;
            }

            await this.processBet(player, bet, roundId);
        }
    }

    async publishJackpotPrize({ finish, prizes, bet }) {
        await this.userBetResultPublisher.publishToUser(
            bet.uid,
            this.collectJackpotResult({ result: finish.result, settlementResult: finish.settlementResult, roundId: finish.roundId, prizes })
        );
    }

    async settleWithJackpotWin({ player, roundId }) {
        const bet = await this.queryBets(roundId);

        await this.processJackpot(player, bet.id, bet, bet.settlementResult.jackpot.winningLine, bet.settlementResult.jackpot.winningPrize);
        await this.processBet(player, bet, roundId, true);
    }

    async processBet(player, bet, roundId, afterJackpot = false) {
        if (bet.settlementResult.bonus?.odds === 0) {
            await this.settleBets(player, { result: bet.result, settlementResult: bet.settlementResult, roundId }, bet);
        } else {
            await this.processBonus(player, { result: bet.result, settlementResult: bet.settlementResult, roundId }, bet, afterJackpot);
        }

        await this.jackpotConsumer.contribute(player, { totalAmount: bet.totalAmount, roundId, rate: bet.rate, freeSpin: bet.freeSpin });
    }

    async generateRoundResult(player, roundId, bet) {
        const { bonus: bonusConfig, icons: odds } = this.gameData.gameConfigs.slotsConfig;
        const { result, settlementResult } = this.generateResultConsumer.generateSettlementResult(player, bet, odds);
        const bonusChests = settlementResult.bonus?.odds > 0 ? this.generateResultConsumer.generateBonus(bet, bonusConfig) : null;

        bet.odds = odds;
        bet.result = result;
        bet.settlementResult = settlementResult;
        bet.bonusChests = bonusChests;

        await bet.save();

        return {
            roundId,
            result,
            settlementResult,
            time: bet.time,
            bonusChests,
        };
    }

    async processFreeSpins(player, betTicket, settlementResult) {
        if (settlementResult.freeSpins?.odds > 0) {
            const { id: roundId, bet, paylines } = betTicket;

            await this.freeSpinsConumer.gainFreeSpin(
                player,
                { roundId, bet, paylines, numberOfFreeSpins: settlementResult.freeSpins.odds },
                this.definition.freeSpinLiveSeconds
            );
        }
    }

    async processBonus(player, finish, bet, afterJackpot) {
        const { result, settlementResult } = finish;
        this.updateBonusTime(player, afterJackpot);
        await this.userBetResultPublisher.publishToUser(bet.uid, this.collectBonusResult({ result, settlementResult, roundId: finish.roundId }));
    }

    updateBonusTime(player, afterJackpot) {
        const { finish } = this.gameData.ingame[player.profile.name];
        if (!finish.bonusTime) {
            finish.bonusTime = new Date();
            afterJackpot && finish.bonusTime.setSeconds(finish.bonusTime.getSeconds() + this.definition.delaySecondsAfterJackpot);
        }
    }

    updateBetTrack(player, finish) {
        this.gameData.ingame[player.profile.name].bonusChests = finish.bonusChests ?? null;
        this.gameData.ingame[player.profile.name].finish = finish;
        this.gameData.ingame[player.profile.name].player = {
            UID: player.UID,
            profile: player.profile,
            session: player.session,
        };
    }

    async processJackpot(player, roundId, bet, winningLine, prize) {
        const baseWinningAmount = (
            await this.jackpotConsumer.hit(player, {
                prize,
                roundId,
                exchangeRateId: bet.exchangeRateId,
                operatorId: bet.operatorId,
                currency: bet.currency,
                rate: bet.rate,
            })
        ).amount;

        const winningAmount = math.round(baseWinningAmount / bet.rate, 4);

        const hitJackpotResult = await this.hitJackpot(player, {
            gameRoundId: roundId,
            gameId: this.definition.id,
            winningAmount,
        });

        const error = hitJackpotResult.isOk ? null : hitJackpotResult.response.message;

        if (error) {
            this.jackpotPublisher.publishFailedJackpot(player.UID, error);
        }

        this.gameData.ingame[player.profile.name].finish.settlementResult.jackpot.winningAmount = winningAmount;
        bet.settlementResult.jackpot.winningAmount = winningAmount;
        await bet.save();

        return { winningAmount, winningLine };
    }

    async settleBets(player, { result, settlementResult, roundId }, bet, bonusChests = []) {
        try {
            if (bet) {
                const odds = bet.odds ?? this.gameData.gameConfigs.slotsConfig.icons;
                const bonus = this.calculateBonusAmount(bonusChests);
                const betResult = this.calculatePaylineResult(settlementResult.winningPaylines, bet, bonus);

                bet.odds = bet.odds ?? odds;
                bet.result = bet.result.length === 0 ? result : bet.result;
                bet.settlementResult = bet.settlementResult ?? settlementResult;
                bet.bonusChests = bonusChests;
                bet.betWin = betResult.totalWin;
                bet.baseBetWin = math.round(betResult.totalWin * bet.rate, 2);
                bet.paid = true;
                bet.endTime = new Date();

                await bet.save();
                await this.callEndGame(bet, roundId, bet.endTime, betResult);

                await this.userBetResultPublisher.publishToUser(
                    bet.uid,
                    this.collectRoundResult({
                        player,
                        roundId,
                        betWin: bet.betWin,
                        bigWin: betResult.bigWin,
                    })
                );

                const ingame = this.gameData.ingame[bet.name];
                betResult.totalWin > 0 &&
                    this.userBetResultPublisher.publishToAllUsersExcept(bet.uid, {
                        winner: {
                            id: bet.uid,
                            name: bet.name,
                            avatarId: ingame.avatarId,
                            betWin: betResult.totalWin,
                            bigWin: betResult.bigWin,
                            rate: bet.rate,
                        },
                    });

                delete ingame.bonusChests;
                delete ingame.finish;
                delete ingame.player;
            }
        } catch (ex) {
            this.logService.logError(ex);
        }
    }

    formatEndGameInfo(bet, roundId, time, betResult) {
        const { gameInfo, settlementInfo } = super.formatEndGameInfo(bet, roundId, time, betResult);

        settlementInfo.redPlay = bet.freeSpin ? 0 : settlementInfo.redPlay;

        return { gameInfo, settlementInfo };
    }

    queryBets(roundId) {
        return this.roundsRepository.findOne({ id: roundId, paid: false }).exec();
    }

    calculatePaylineResult(paylines, bet, bonus = 0) {
        const { bigWinRatio } = this.gameData.gameConfigs.slotsConfig;

        const betResult = paylines.reduce(
            (result, paylineItem) => {
                result.totalWin += bet.bet * paylineItem.odds;

                return result;
            },
            {
                totalBetAmount: 0,
                totalWin: 0,
                netWin: 0,
                totalLost: 0,
                winningLines: [],
            }
        );

        betResult.totalBetAmount = bet.totalAmount;
        betResult.bigWin = (betResult.totalWin + bonus) / bigWinRatio >= betResult.totalBetAmount;
        betResult.totalWin = parseFloat((betResult.totalWin + bonus).toFixed(2));
        betResult.netWin = parseFloat((betResult.totalWin + bonus - betResult.totalBetAmount).toFixed(2));
        betResult.totalLost = betResult.totalBetAmount - betResult.totalWin > 0 ? betResult.totalBetAmount - betResult.totalWin : 0;

        return betResult;
    }

    calculateBonusAmount(bonusChests) {
        return bonusChests?.reduce((bonusAmount, chest) => bonusAmount + chest.amount, 0) ?? 0;
    }

    collectRoundResult({ roundId, betWin, bigWin }) {
        return {
            finish: {
                roundId,
                result: {
                    betWin,
                    bigWin,
                },
            },
        };
    }

    collectRoundSettlementResult({ winningPaylines, bonus, freeSpins, jackpot }) {
        const boardDefinition = this.generateResultConsumer.boardDefinition;
        const winningLines = winningPaylines.map((winningPayline) => {
            return {
                payline: winningPayline.payline,
                symbol: winningPayline.symbol,
                count: winningPayline.count,
                positions: boardDefinition.paylines[winningPayline.payline],
            };
        });
        const winningBonus = {
            symbol: boardDefinition.specialSymbols.bonus,
            count: bonus.odds,
        };
        const winningFreeSpins = {
            symbol: boardDefinition.specialSymbols.freeSpins,
            count: freeSpins.odds,
        };
        const winningJackpot = jackpot
            ? {
                  winningLine: jackpot.winningLine,
                  winningAmount: jackpot.winningAmount,
                  winningPrize: jackpot.winningPrize,
                  symbol: boardDefinition.specialSymbols.jackpot,
                  positions: boardDefinition.paylines[jackpot.winningLine],
              }
            : null;

        return {
            winningLines,
            bonus: winningBonus,
            freeSpins: winningFreeSpins,
            jackpot: winningJackpot,
        };
    }

    collectBonusResult({ result, settlementResult, roundId }) {
        const { bonus } = settlementResult;
        const numberOfBonusChests = bonus.odds;

        return {
            bonuses: {
                roundId,
                bonus: numberOfBonusChests,
                result,
            },
        };
    }

    collectJackpotResult({ result, settlementResult, roundId, prizes }) {
        return {
            jackpot: {
                roundId,
                prizes: prizes.length,
                result,
                winningLine: settlementResult.jackpot.winningLine,
                symbol: this.boardDefinition.specialSymbols.jackpot,
            },
        };
    }
}
