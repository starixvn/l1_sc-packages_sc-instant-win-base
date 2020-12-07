import moment from "moment";
import { Core } from "sc-game-base";

import BoardGenerator from "../board/board-generator";
import PaylineCalculator from "../board/payline-calculator";
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
        jackpotConsummer = null
    ) {
        super(definition, gameData, roundResultPublisher, userBetResultPublisher);

        this.boardGenerator = boardGenerator ?? new BoardGenerator(definition);
        this.paylineCalculator = paylineCalculator ?? new PaylineCalculator(definition);
        this.jackpotConsumer = jackpotConsummer ?? new JackpotConsumer(definition, gameData);
    }

    async settleRound(player, roundId) {
        //TODO get bet from ingame?
        const bet = await this.definition.betRepository.find({ phien: roundId }).lean().exec();

        const result = this.generateResult(bet.name);
        const odds = this.gameData.gameConfigs.slotsConfig.icons;

        const settlementResult = this.paylineCalculator.calculate(result, bet.paylines, odds);

        const finish = {
            settlementResult,
            result,
            roundId,
            time: new Date(),
            jackpotWin: 0,
        };

        await this.processFreeSpins(bet, settlementResult);

        if (settlementResult.bonus == 0) {
            if (settlementResult.jackpot) {
                finish.jackpotWin = await this.jackpotConsumer.hit(player, { pool: bet.bet, totalAmount: bet.totalAmount, roundId });
            } else {
                await this.jackpotConsumer.contribution(player, { pool: bet.bet, totalAmount: bet.totalAmount, roundId });
            }

            await this.settleBets(finish);
        } else {
            //TODO check bonus, consider base in bonus round then restart game
        }
    }

    generateResult(playerName) {
        const { mode } = this.gameData.gameConfigs.slotsConfig;
        const resultFromAdmin = this.gameData.settlementResultFromAdmin[playerName];

        delete this.gameData.settlementResultFromAdmin[playerName];

        return resultFromAdmin ?? this.boardGenerator.generate(mode);
    }

    async processFreeSpins(bet, settlementResult) {
        const expirationHours = 24;

        if (settlementResult.freeSpins > 0) {
            await this.definition.freeSpinRepository.create({
                time: new Date(),
                roundId: bet.id,
                uid: bet.uid,
                memberId: bet.memberId,
                name: bet.name,
                total: settlementResult.freeSpins,
                available: settlementResult.freeSpins,
            });

            this.gameData.ingame[player.profile.name].freeSpins.push({
                time: new Date(),
                expiration: moment.utc().add(expirationHours, "hours").toDate(),
                count: settlementResult.freeSpins,
            });
        }
    }

    async settleBets({ result, settlementResult, roundId, time, jackpotWin }) {
        const bet = await this.queryBets(roundId);

        if (bet) {
            const { bigWinRatio } = this.gameData.gameConfigs.slotsConfig;
            const betResult = this.calculatePaylineResult(settlementResult, bet, jackpotWin);

            bet.betwin = betResult.totalWin;
            bet.thanhtoan = true;
            bet.result = result;
            bet.settlementResult = settlementResult;

            await bet.save();
            await this.callEndGame(bet, roundId, time, betResult);

            await this.userBetResultPublisher.publish(bet.uid, betResult);

            if (bet.betWin / bigWinRatio > 1) {
                //TODO publish bigWin
                //TODO store hall of fame
            }
        }
    }

    calculatePaylineResult(paylines, bet, jackpotWin) {
        const betResult = Object.entries(paylines).reduce(
            (result, payline) => {
                const betAmount = bet.bet;
                const winAmount = payline.odds > 0 ? betAmount * payline.odds : 0;

                result.totalBetAmount = bet.totalAmount;
                result.totalWin += winAmount;
                result.winningByChoices[payline] = winAmount;

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
                winningByChoices: {},
            }
        );

        betResult.totalWin = parseFloat((betResult.totalWin + jackpotWin).toFixed(2));
        betResult.netWin = parseFloat((betResult.netWin + jackpotWin).toFixed(2));

        return betResult;
    }
}
