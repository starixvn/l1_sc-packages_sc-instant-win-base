import mongoose from "mongoose";
import { Core } from "sc-game-base";

import { BoardGenerator, BonusBoardGenerator, PaylineCalculator } from "./../board";
import { JackpotPublisher } from "./../event-publishers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
import BoardCheatingConsumer from "./board-cheating-consumer";
import FreeSpinsConsumer from "./free-spins-consumer";
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
     * @param {BoardCheatingConsumer} dependencies.boardCheatingConsumer
     * @param {FreeSpinsConsumer} dependencies.freeSpinsConsumer
     * @param {HallOfFameConsumer} dependencies.hallOfFameConsumer
     * @param {JackpotConsumer} dependencies.jackpotConsumer
     * @param {BoardGenerator} boardGenerator
     * @param {BonusBoardGenerator} bonusBoardGenerator
     * @param {PaylineCalculator} paylineCalculator
     * @param {endGameApi} endGame
     * @param {hitJackpotApi} hitJackpot
     * @param {mongoose.Model} dependencies.roundsRepository
     * @param {mongoose.Model} dependencies.betsRepository
     */

    constructor({
        definition,
        gameData,
        roundResultPublisher,
        userBetResultPublisher,
        jackpotPublisher,
        boardCheatingConsumer,
        freeSpinsConsumer,
        hallOfFameConsumer,
        jackpotConsumer,
        boardGenerator,
        bonusBoardGenerator,
        paylineCalculator,
        endGame,
        hitJackpot,
        roundsRepository,
        betsRepository,
        logService,
        jackpotValidator,
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
        this.boardCheatingConsumer = boardCheatingConsumer;
        this.freeSpinsConumer = freeSpinsConsumer;
        this.hallOfFameConsumer = hallOfFameConsumer;
        this.jackpotConsumer = jackpotConsumer;
        this.boardGenerator = boardGenerator;
        this.bonusBoardGenerator = bonusBoardGenerator;
        this.paylineCalculator = paylineCalculator;
        this.hitJackpot = hitJackpot;
        this.logService = logService;
        this.jackpotValidator = jackpotValidator;
    }

    async autoSettleRound(player, roundId) {
        if (this.gameData.ingame[player.profile.name].finish) {
            const bet = await this.queryBets(roundId);
            const { bonusChests, finish } = this.gameData.ingame[player.profile.name];

            await this.settleBets(
                player,
                finish,
                bet,
                bonusChests.filter((chest) => chest.picked)
            );
        }
    }

    async settleRound(player, roundId) {
        const bet = await this.queryBets(roundId);

        if (bet) {
            const finish = await this.generateRoundResult(player, roundId, bet);

            await this.processFreeSpins(player, bet, finish.settlementResult);

            if (finish.settlementResult.bonus?.odds === 0) {
                await this.settleBets(player, finish, bet);
            } else {
                await this.processBonus(player, finish, bet);
            }

            if (this.jackpotValidator.canContributeJackpotPools(player, bet.freeSpin)) {
                await this.jackpotConsumer.contribute(player, { pool: bet.bet, totalAmount: bet.totalAmount, roundId, rate: bet.rate });
            }
        }
    }

    async generateRoundResult(player, roundId, bet) {
        const { icons: odds } = this.gameData.gameConfigs.slotsConfig;
        const result = this.generateResult(bet.name);
        const settlementResult = this.paylineCalculator.calculate(result, bet.paylines, odds);

        settlementResult.jackpot = await this.settleJackpot(player, roundId, bet, settlementResult);
        settlementResult.winningPaylines = this.settleWinningPaylines(settlementResult);

        return {
            roundId,
            result,
            settlementResult,
            jackpotWin: settlementResult.jackpot ? settlementResult.jackpot.winningAmount : 0,
            time: bet.time,
        };
    }

    async settleJackpot(player, roundId, bet, settlementResult) {
        return settlementResult.jackpotPayline > -1 && this.jackpotValidator.canHitJackpot(player)
            ? await this.processJackpot(player, roundId, bet, settlementResult.jackpotPayline)
            : null;
    }

    settleWinningPaylines(settlementResult) {
        return settlementResult.jackpot
            ? settlementResult.paylines.filter(
                  (payline) => payline.odds > 0 && payline.symbol !== this.boardGenerator.definition.specialSymbols.jackpot
              )
            : settlementResult.paylines.filter((payline) => payline.odds > 0);
    }

    generateResult(playerName) {
        const { mode } = this.gameData.gameConfigs.slotsConfig;
        const board = this.boardGenerator.generate(mode);

        return this.boardCheatingConsumer.consume(playerName, board);
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

    async processBonus(player, finish, bet) {
        const { bonus: bonusConfig, icons: odds } = this.gameData.gameConfigs.slotsConfig;
        const { result, settlementResult } = finish;

        finish.bonusChests = this.bonusBoardGenerator.generate(bet.bet, bonusConfig.min, bonusConfig.max, bet.paylines.length);

        bet.odds = odds;
        bet.result = result;
        bet.settlementResult = settlementResult;
        bet.bonusChests = finish.bonusChests;

        await bet.save();

        this.gameData.ingame[player.profile.name].bonusChests = finish.bonusChests;
        this.gameData.ingame[player.profile.name].finish = finish;
        this.gameData.ingame[player.profile.name].player = {
            UID: player.UID,
            profile: player.profile,
            session: player.session,
        };

        await this.userBetResultPublisher.publishToUser(bet.uid, this.collectBonusResult({ result, settlementResult, roundId: finish.roundId }));
    }

    async processJackpot(player, roundId, bet, winningLine) {
        const winningAmount = (await this.jackpotConsumer.hit(player, { pool: bet.bet, roundId })).amount;
        const hitJackpotResult = await this.hitJackpot(player, {
            gameRoundId: roundId,
            gameId: this.definition.id,
            winningAmount: math.round(winningAmount / bet.rate, 4),
        });
        
        const error = hitJackpotResult.isOk ? null : hitJackpotResult.response.message;

        if (error) {
            this.jackpotPublisher.publishFailedJackpot(player.UID, error);
        }

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
                bet.paid = true;
                bet.endTime = new Date();

                await bet.save();
                await this.callEndGame(bet, roundId, bet.endTime, betResult);

                await this.userBetResultPublisher.publishToUser(
                    bet.uid,
                    this.collectRoundResult({
                        player,
                        result,
                        settlementResult,
                        roundId,
                        betWin: bet.betWin,
                        bigWin: betResult.bigWin,
                        betByFreeSpin: bet.freeSpin,
                    })
                );

                if (betResult.bigWin) {
                    await this.hallOfFameConsumer.add(player, {
                        roundId,
                        bet: bet.bet,
                        rate: bet.rate,
                        totalAmount: bet.totalAmount,
                        winningAmount: betResult.totalWin,
                        numberOfPaylines: bet.paylines.length,
                        freeSpin: bet.freeSpin,
                    });
                }

                delete this.gameData.ingame[player.profile.name].bonusChests;
                delete this.gameData.ingame[player.profile.name].finish;
                delete this.gameData.ingame[player.profile.name].player;
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
                bigWin: false,
            }
        );

        betResult.totalBetAmount = bet.totalAmount;
        betResult.bigWin = (betResult.totalWin + bonus) / bigWinRatio > betResult.totalBetAmount;
        betResult.totalWin = parseFloat((betResult.totalWin + bonus).toFixed(2));
        betResult.netWin = parseFloat((betResult.totalWin + bonus - betResult.totalBetAmount).toFixed(2));
        betResult.totalLost = betResult.totalBetAmount - betResult.totalWin > 0 ? betResult.totalBetAmount - betResult.totalWin : 0;

        return betResult;
    }

    calculateBonusAmount(bonusChests) {
        return bonusChests?.reduce((bonusAmount, chest) => bonusAmount + chest.amount, 0) ?? 0;
    }

    collectRoundResult({ player, result, settlementResult, roundId, betWin, bigWin, betByFreeSpin }) {
        const totalOfFreeSpins = this.freeSpinsConumer.getTotalAvaiableFreeSpins(player);
        const roundSettlementResult = this.collectRoundSettlementResult(settlementResult);

        return {
            finish: {
                roundId,
                betByFreeSpin,
                result,
                settlementResult: roundSettlementResult,
                betWin,
                bigWin,
                totalOfFreeSpins,
            },
        };
    }

    collectRoundSettlementResult({ winningPaylines, bonus, freeSpins, jackpot }) {
        const winningLines = winningPaylines.map((winningPayline) => {
            return {
                payline: winningPayline.payline,
                symbol: winningPayline.symbol,
                count: winningPayline.count,
                positions: this.paylineCalculator.definition.paylines[winningPayline.payline],
            };
        });
        const winningBonus = {
            symbol: this.boardGenerator.definition.specialSymbols.bonus,
            count: bonus.odds,
        };
        const winningFreeSpins = {
            symbol: this.boardGenerator.definition.specialSymbols.freeSpins,
            count: freeSpins.odds,
        };
        const winningJackpot = jackpot
            ? {
                  ...jackpot,
                  symbol: this.boardGenerator.definition.specialSymbols.jackpot,
                  positions: this.paylineCalculator.definition.paylines[jackpot.winningLine],
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
}
