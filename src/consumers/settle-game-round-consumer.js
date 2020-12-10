import { Core } from "sc-game-base";

import BoardGenerator from "../board/board-generator";
import BonusBoardGenerator from "../board/bonus-board-generator";
import PaylineCalculator from "../board/payline-calculator";
import FreeSpinsConsumer from "./free-spins-consumer";
import HallOfFameConsumer from "./hall-of-fame-consumer";
import JackpotConsumer from "./jackpot-consumer";

export default class SettleGameRoundConsumer extends Core.BaseEventConsumers.SettleGameRoundConsumer {
    /**
     * @param {BoardGenerator} boardGenerator
     */

    constructor(
        definition,
        gameData,
        roundResultPublisher = null,
        userBetResultPublisher = null,
        boardGenerator = null,
        paylineCalculator = null,
        jackpotConsummer = null,
        freeSpinsConsumer = null,
        hallOfFameConsumer = null
    ) {
        super(definition, gameData, roundResultPublisher, userBetResultPublisher);

        this.boardGenerator = boardGenerator ?? new BoardGenerator();
        this.paylineCalculator = paylineCalculator ?? new PaylineCalculator(definition);
        this.jackpotConsumer = jackpotConsummer ?? new JackpotConsumer(definition, gameData);
        this.freeSpinsConumer = freeSpinsConsumer ?? new FreeSpinsConsumer(definition, gameData);
        this.hallOfFameConsumer = hallOfFameConsumer ?? new HallOfFameConsumer(definition);
    }

    async settleRound(player, roundId) {
        //TODO get bet from ingame?
        const bet = await this.definition.roundRepository.find({ id: roundId }).lean().exec();

        const result = this.generateResult(bet.name);
        const odds = this.gameData.gameConfigs.slotsConfig.icons;

        const settlementResult = this.paylineCalculator.calculate(result, bet.paylines, odds);
        const jackpotWin = settlementResult.jackpot ? await this.jackpotConsumer.hit(player, { pool: bet.bet, roundId }) : 0;
        const time = new Date();

        const finish = {
            settlementResult,
            result,
            roundId,
            time,
            jackpotWin,
        };

        await this.jackpotConsumer.contribution(player, { pool: bet.bet, totalAmount: bet.totalAmount, roundId });

        await this.processFreeSpins(player, bet, settlementResult);

        if (settlementResult.bonus == 0) {
            await this.settleBets(player, finish);
        } else {
            const { bonus } = this.gameData.gameConfigs.slotsConfig;
            const bonusChests = new BonusBoardGenerator({ size: this.definition.bonusSize, minRate: bonus.min, maxRate: bonus.max }).generate(
                bet.bet
            );

            const existingBetFilter = { uid: player.UID, roundId: roundId };

            const updatedBet = {
                result,
                settlementResult,
                jackpotWin,
                time,
                bonusChests,
            };

            await this.definition.roundRepository.updateOne(existingBetFilter, updatedBet);

            this.gameData.ingame[player.profile.name].bonusChests = bonusChests;
            this.gameData.ingame[player.profile.name].finish = finish;
            this.gameData.ingame[player.profile.name].player = {
                UID: player.UID,
                profile: player.profile,
                session: player.session,
            };
        }
    }

    async settleRoundWithBonus(player) {
        const { bonusChests, finish } = this.gameData.ingame[player.profile.name];

        await this.settleBets(
            player,
            finish,
            bonusChests.filter((chest) => chest.picked)
        );

        delete this.gameData.ingame[player.profile.name].bonusChests;
        delete this.gameData.ingame[player.profile.name].finish;
        delete this.gameData.ingame[player.profile.name].player;
    }

    generateResult(playerName) {
        const { mode } = this.gameData.gameConfigs.slotsConfig;
        const resultFromAdmin = this.gameData.settlementResultFromAdmin[playerName];

        delete this.gameData.settlementResultFromAdmin[playerName];

        return resultFromAdmin ?? this.boardGenerator.generate(mode);
    }

    async processFreeSpins(player, betTicket, settlementResult) {
        if (settlementResult.freeSpins > 0) {
            const { roundId, bet, paylines } = betTicket;

            await this.freeSpinsConumer.gainFreeSpin(
                player,
                { roundId, bet, paylines, numberOfFreeSpins: settlementResult.freeSpins },
                this.definition.freeSpinExpirationHours * 3600
            );
        }
    }

    async settleBets(player, { result, settlementResult, roundId, time, jackpotWin }, bonusChests = []) {
        const bet = await this.queryBets(roundId);

        if (bet) {
            const bonus = this.calculateBonus(bonusChests);
            const betResult = this.calculatePaylineResult(settlementResult, bet, jackpotWin, bonus);

            bet.betwin = betResult.totalWin;
            bet.thanhtoan = true;
            bet.result = result;
            bet.settlementResult = settlementResult;
            bet.bonusChests = bonusChests;

            await bet.save();
            await this.callEndGame(bet, roundId, time, betResult);

            await this.userBetResultPublisher.publish(bet.uid, betResult);

            if (betResult.bigWin) {
                await this.hallOfFameConsumer.add(player, {
                    roundId,
                    bet: bet.bet,
                    numberOfPaylines: bet.paylines.length,
                    totalAmount: bet.totalAmount,
                    winningAmount: betResult.totalWin,
                });
            }
        }
    }

    queryBets(roundId) {
        return this.definition.roundRepository.find({ id: roundId }).exec();
    }

    calculatePaylineResult(paylines, bet, jackpotWin, bonus = 0) {
        const { bigWinRatio } = this.gameData.gameConfigs.slotsConfig;

        const betResult = paylines.reduce(
            (result, paylineItem) => {
                const betAmount = bet.bet;
                const winAmount = paylineItem.odds > 0 ? betAmount * paylineItem.odds : 0;

                result.totalBetAmount = bet.totalAmount;
                result.totalWin += winAmount;
                result.winningLines.push(paylineItem.payline);

                if (winAmount > 0) {
                    result.netWin += winAmount - betAmount;
                } else {
                    result.totalLost += betAmount;
                }

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

        betResult.bigWin = betResult.totalWin / bigWinRatio > betResult.totalAmount;
        betResult.totalWin = parseFloat((betResult.totalWin + jackpotWin + bonus).toFixed(2));
        betResult.netWin = parseFloat((betResult.netWin + jackpotWin + bonus).toFixed(2));

        return betResult;
    }

    calculateBonus(bonusChests) {
        if (bonusChests && bonusChests.length == 0) {
            return 0;
        }

        return bonusChests.reduce((result, chest) => (result += chest.amount), 0);
    }
}
