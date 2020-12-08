import moment from "moment";
import { Core } from "sc-game-base";

import BoardGenerator from "../board/board-generator";
import BonusBoardGenerator from "../board/bonus-board-generator";
import PaylineCalculator from "../board/payline-calculator";
import FreeSpinsConsumer from "./free-spins-consumer";
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
        freeSpinsConsumer = null
    ) {
        super(definition, gameData, roundResultPublisher, userBetResultPublisher);

        this.boardGenerator = boardGenerator ?? new BoardGenerator(definition);
        this.paylineCalculator = paylineCalculator ?? new PaylineCalculator(definition);
        this.jackpotConsumer = jackpotConsummer ?? new JackpotConsumer(definition, gameData);
        this.freeSpinsConumer = freeSpinsConsumer ?? new FreeSpinsConsumer(definition, gameData);
    }

    async settleRound(player, roundId) {
        //TODO get bet from ingame?
        const bet = await this.definition.betRepository.find({ phien: roundId }).lean().exec();

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
            await this.settleBets(finish);
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

            await this.definition.betRepository.updateOne(existingBetFilter, updatedBet);

            this.gameData.ingame[player.profile.name].bonusChests = bonusChests;
            this.gameData.ingame[player.profile.name].settlementResult = settlementResult;
        }
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
                this.definition.expirationHours * 3600
            );
        }
    }

    async settleBets({ result, settlementResult, roundId, time, jackpotWin }) {
        const bet = await this.queryBets(roundId);

        if (bet) {
            const betResult = this.calculatePaylineResult(settlementResult, bet, jackpotWin);

            bet.betwin = betResult.totalWin;
            bet.thanhtoan = true;
            bet.result = result;
            bet.settlementResult = settlementResult;

            await bet.save();
            await this.callEndGame(bet, roundId, time, betResult);

            await this.userBetResultPublisher.publish(bet.uid, betResult);

            if (betResult.bigWin) {
                //TODO store hall of fame
            }
        }
    }

    calculatePaylineResult(paylines, bet, jackpotWin) {
        const { bigWinRatio } = this.gameData.gameConfigs.slotsConfig;

        const betResult = Object.entries(paylines).reduce(
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

        betResult.totalWin = parseFloat((betResult.totalWin + jackpotWin).toFixed(2));
        betResult.netWin = parseFloat((betResult.netWin + jackpotWin).toFixed(2));
        betResult.bigWin = betResult.totalWin / bigWinRatio > 1;

        return betResult;
    }
}
