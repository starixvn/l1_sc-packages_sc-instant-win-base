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

    async autoSettleRound(player) {
        if (this.gameData.ingame[player.profile.name].finish) {
            const { bonusChests, finish } = this.gameData.ingame[player.profile.name];

            await this.settleBets(
                player,
                finish,
                bonusChests.filter((chest) => chest.picked)
            );
        }
    }

    async settleRound(player, roundId) {
        const bet = await this.definition.roundRepository.findOne({ id: roundId, paid: false }).lean().exec();

        if (bet) {
            const finish = await this.generateRoundResult(player, roundId, bet);

            await this.processFreeSpins(player, bet, finish.settlementResult);

            if (finish.settlementResult.bonus?.odds === 0) {
                await this.settleBets(player, finish);
            } else {
                await this.processBonus(player, finish, bet);
            }

            if (!bet.freeSpin) {
                await this.jackpotConsumer.contribute(player, { pool: bet.bet, totalAmount: bet.totalAmount, roundId });
            }
        }
    }

    async generateRoundResult(player, roundId, bet) {
        const result = this.generateResult(bet.name);
        const odds = this.gameData.gameConfigs.slotsConfig.icons;

        const settlementResult = this.paylineCalculator.calculate(result, bet.paylines, odds);
        settlementResult.paylines = settlementResult.paylines.filter((payline) => payline.odds > 0);
        const jackpotWin = settlementResult.jackpot ? (await this.jackpotConsumer.hit(player, { pool: bet.bet, roundId })).amount : 0;

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
        const { bonus, icons: odds } = this.gameData.gameConfigs.slotsConfig;
        const { result, settlementResult } = finish;
        finish.bonusChests = new BonusBoardGenerator({ size: this.definition.bonusSize, minRate: bonus.min, maxRate: bonus.max }).generate(bet.bet);

        const existingBetFilter = { id: finish.roundId };
        const updatedBet = { ...finish, odds, results: finish.result };

        delete updatedBet.result;

        await this.definition.roundRepository.updateOne(existingBetFilter, updatedBet);

        this.gameData.ingame[player.profile.name].bonusChests = finish.bonusChests;
        this.gameData.ingame[player.profile.name].finish = finish;
        this.gameData.ingame[player.profile.name].player = {
            UID: player.UID,
            profile: player.profile,
            session: player.session,
        };

        await this.userBetResultPublisher.publishToUser(bet.uid, this.collectRoundResult({ result, settlementResult, roundId: finish.roundId }));
    }

    async settleBets(player, { result, settlementResult, roundId, jackpotWin }, bonusChests = []) {
        const bet = await this.queryBets(roundId);

        if (bet) {
            const odds = bet.odds ?? this.gameData.gameConfigs.slotsConfig.icons;
            const bonus = this.calculateBonus(bonusChests);

            const betResult = this.calculatePaylineResult(settlementResult.paylines, bet, jackpotWin, bonus);
            bet.odds = bet.odds ?? odds;
            bet.betWin = betResult.totalWin;
            bet.paid = true;
            bet.results = bet.results.length === 0 ? result : bet.results;
            bet.settlementResult = bet.settlementResult ?? settlementResult;
            bet.bonusChests = bonusChests;
            bet.endTime = new Date();

            await bet.save();
            await this.callEndGame(bet, roundId, bet.endTime, betResult);

            await this.userBetResultPublisher.publishToUser(
                bet.uid,
                this.collectRoundResult({
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

    async queryBets(roundId) {
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

        betResult.winningLines = paylines.map((item) => item.payline);
        betResult.totalBetAmount = bet.totalAmount;
        betResult.bigWin = betResult.totalWin / bigWinRatio > betResult.totalBetAmount;
        betResult.totalWin = parseFloat((betResult.totalWin + jackpotWin + bonus).toFixed(2));
        betResult.netWin = parseFloat((betResult.totalWin + jackpotWin + bonus - betResult.totalBetAmount).toFixed(2));
        betResult.totalLost = betResult.totalBetAmount - betResult.totalWin > 0 ? betResult.totalBetAmount - betResult.totalWin : 0;

        return betResult;
    }

    calculateBonus(bonusChests) {
        if (bonusChests && bonusChests.length === 0) {
            return 0;
        }

        return bonusChests.reduce((result, chest) => result + chest.amount, 0);
    }

    collectRoundResult({ result, settlementResult, roundId, betWin = 0, bigWin = false }) {
        return {
            finish: {
                result,
                settlementResult,
                roundId,
                betWin,
                bigWin,
            },
        };
    }
}
