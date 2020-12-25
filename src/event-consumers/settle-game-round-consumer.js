import { Core } from "sc-game-base";

import { BoardGenerator, BonusBoardGenerator, PaylineCalculator } from "./../board";
import BoardCheatingConsumer from "./board-cheating-consumer";
import FreeSpinsConsumer from "./free-spins-consumer";
import HallOfFameConsumer from "./hall-of-fame-consumer";
import JackpotConsumer from "./jackpot-consumer";

export default class SettleGameRoundConsumer extends Core.BaseEventConsumers.SettleGameRoundConsumer {
    /**
     * @param {BoardGenerator} boardGenerator
     */

    constructor({
        definition,
        gameData,
        roundResultPublisher = null,
        userBetResultPublisher = null,
        boardGenerator = null,
        paylineCalculator = null,
        jackpotConsummer = null,
        freeSpinsConsumer = null,
        hallOfFameConsumer = null,
        boardCheatingConsumer = null,
    }) {
        super(definition, gameData, roundResultPublisher, userBetResultPublisher);

        this.boardGenerator = boardGenerator ?? new BoardGenerator();
        this.paylineCalculator = paylineCalculator ?? new PaylineCalculator();
        this.jackpotConsumer = jackpotConsummer ?? new JackpotConsumer(definition, gameData);
        this.freeSpinsConumer = freeSpinsConsumer ?? new FreeSpinsConsumer(definition, gameData);
        this.hallOfFameConsumer = hallOfFameConsumer ?? new HallOfFameConsumer(definition);
        this.boardCheatingConsumer = boardCheatingConsumer ?? new BoardCheatingConsumer(gameData);
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

            if (!bet.freeSpin && this.isUserEnableJackpot(player)) {
                await this.jackpotConsumer.contribute(player, { pool: bet.bet, totalAmount: bet.totalAmount, roundId });
            }
        }
    }

    isUserEnableJackpot(player) {
        const { jackpot } = this.gameData.gameConfigs.slotsConfig;

        return player.session.currency !== "UUS" || !jackpot.excludeUUS;
    }

    async generateRoundResult(player, roundId, bet) {
        const result = this.generateResult(bet.name);
        const odds = this.gameData.gameConfigs.slotsConfig.icons;

        const settlementResult = this.paylineCalculator.calculate(result, bet.paylines, odds);
        const jackpotWin =
            settlementResult.jackpotPayline > -1 && this.isUserEnableJackpot(player)
                ? (await this.jackpotConsumer.hit(player, { pool: bet.bet, roundId })).amount
                : 0;

        settlementResult.winningPaylines = settlementResult.paylines.filter((payline) => payline.odds > 0);
        settlementResult.jackpot = jackpotWin > 0 ? { winningLine: settlementResult.jackpotPayline, winningAmount: jackpotWin } : null;

        return {
            roundId,
            result,
            settlementResult,
            jackpotWin,
            time: bet.time,
        };
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
        finish.bonusChests = new BonusBoardGenerator({
            size: this.definition.bonusSize,
            minRate: bonusConfig.min,
            maxRate: bonusConfig.max,
        }).generate(bet.bet);

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

    async settleBets(player, { result, settlementResult, roundId, jackpotWin }, bet, bonusChests = []) {
        if (bet) {
            const odds = bet.odds ?? this.gameData.gameConfigs.slotsConfig.icons;
            const bonus = this.calculateBonusAmount(bonusChests);

            const betResult = this.calculatePaylineResult(settlementResult.winningPaylines, bet, jackpotWin, bonus);
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
                })
            );

            if (betResult.bigWin) {
                await this.hallOfFameConsumer.add(player, {
                    roundId,
                    bet: bet.bet,
                    numberOfPaylines: bet.paylines.length,
                    totalAmount: bet.totalAmount,
                    winningAmount: betResult.totalWin,
                });
            }

            delete this.gameData.ingame[player.profile.name].bonusChests;
            delete this.gameData.ingame[player.profile.name].finish;
            delete this.gameData.ingame[player.profile.name].player;
        }
    }

    queryBets(roundId) {
        return this.definition.roundRepository.findOne({ id: roundId, paid: false }).exec();
    }

    calculatePaylineResult(paylines, bet, jackpotWin, bonus = 0) {
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
        betResult.totalWin = parseFloat((betResult.totalWin + jackpotWin + bonus).toFixed(2));
        betResult.netWin = parseFloat((betResult.totalWin + jackpotWin + bonus - betResult.totalBetAmount).toFixed(2));
        betResult.totalLost = betResult.totalBetAmount - betResult.totalWin > 0 ? betResult.totalBetAmount - betResult.totalWin : 0;

        return betResult;
    }

    calculateBonusAmount(bonusChests) {
        return bonusChests?.reduce((bonusAmount, chest) => bonusAmount + chest.amount, 0) ?? 0;
    }

    collectRoundResult({ player, result, settlementResult, roundId, betWin = 0, bigWin = false }) {
        const { winningPaylines, bonus, freeSpins, jackpot } = settlementResult;
        const totalOfFreeSpins = this.freeSpinsConumer.getTotalAvaiableFreeSpins(player);
        const winningLines = winningPaylines.map((winningPayline) => {
            return {
                payline: winningPayline.payline,
                symbol: winningPayline.symbol,
                count: winningPayline.count,
                positions: this.paylineCalculator.definition.paylines[winningPayline.payline],
            };
        });
        const numberOfBonusChests = bonus.odds;
        const numerOfGainedFreeSpins = freeSpins.odds;
        const roundSettlementResult = {
            winningLines,
            bonus: numberOfBonusChests,
            freeSpins: numerOfGainedFreeSpins,
            jackpot,
        };

        return {
            finish: {
                roundId,
                result,
                settlementResult: roundSettlementResult,
                betWin,
                bigWin,
                totalOfFreeSpins,
            },
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
