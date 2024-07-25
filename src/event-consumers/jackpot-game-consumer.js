import Chance from "chance";
import moment from "moment";

import { JackpotPublisher } from "./../event-publishers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
import SettleGameRoundConsumer from "./settle-game-round-consumer";
import SlotNoticeHelper from "./../helpers/slot-notice-helper";

export default class JackpotGameConsumer {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {JackpotPublisher} jackpotPublisher
     * @param {SettleGameRoundConsumer} settleGameRoundConsumer
     * @param {mongoose.Model} dependencies.roundsRepository
     */
    constructor({ definition, gameData, jackpotPublisher, settleGameRoundConsumer, roundsRepository, logService }) {
        this.definition = definition;
        this.gameData = gameData;
        this.jackpotPublisher = jackpotPublisher;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.roundsRepository = roundsRepository;
        this.logService = logService;

        this.chance = new Chance();
    }

    //TODO update SlotNoticeHelper.invalidBonus to jackpot invalid
    //TODO be careful for duplicated event
    async consume(player, payload) {
        const { chest } = payload;

        if (!this.validate(player, chest)) {
            return;
        }

        const { bet, prize } = await this.pickJackpotAndUpdateBet({ player, chest });

        if (!bet) {
            this.jackpotPublisher.publishToUser(player.UID, { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidBonus } });
            return;
        }

        const { winningAmount, winningLine } = await this.settleGameRoundConsumer.processJackpot(
            player,
            bet.id,
            bet,
            bet.settlementResult.jackpot.winningLine,
            prize
        );

        await this.settleGameRoundConsumer.settleWithJackpotWin({ roundId: bet.id, prize, winningAmount, winningLine });
    }

    //TODO combine processJackpot and settleWithJackpotWin into ONE
    async pickJackpotAndUpdateBet({ player, chest }) {
        const jackpot = this.getJackpot(player);

        if (!jackpot || jackpot.prizes?.length === 0) {
            return { bet: null, prize: null };
        }

        if (!chest) {
            chest = this.chance.integer({ min: 0, max: jackpot.prizes.length - 1 });
        }

        const bet = await this.roundsRepository.findOneAndUpdate(
            { playerId: player.session.playerId, paid: false, jackpot: { picked: false } },
            { $set: { jackpot: { picked: true } } },
            {
                new: true,
                lean: true,
            }
        );

        if (bet) {
            jackpot.picked = true;

            return { bet, prize: jackpot.prizes[chest] };
        }

        return { bet: null, prize: null };
    }

    async processExpired() {
        const expiryTime = moment.utc().subtract(this.definition.jackpotLiveSeconds, "seconds").toDate();

        try {
            const runningBets = Object.values(this.gameData.ingame).filter(
                (currentBet) => currentBet.finish && currentBet.finish.time < expiryTime && this.isHavingJackpot(currentBet)
            );

            for (const ingameBet of runningBets) {
                const { player } = ingameBet;
                await this.autoPickJackpot(player);
            }
        } catch (error) {
            this.logService.logError(error);
        }
    }

    async autoPickJackpot(player) {
        const { bet, prize } = await this.pickJackpotAndUpdateBet({ player });

        if (!bet) {
            return;
        }

        const { winningAmount, winningLine } = await this.settleGameRoundConsumer.processJackpot(
            player,
            bet.id,
            bet,
            bet.settlementResult.jackpot.winningLine,
            prize
        );

        await this.settleGameRoundConsumer.settleWithJackpotWin({ roundId: bet.id, prize, winningAmount, winningLine });
    }

    isHavingJackpot(bet) {
        const { jackpot } = bet.finish;

        return jackpot ? jackpot.winningLine > 0 && !jackpot.picked : false;
    }

    validate(player, chest) {
        const jackpot = this.getJackpot(player);

        if (jackpot.picked || this.isInvalidChest(chest, jackpot.prizes)) {
            this.jackpotPublisher.publishToUser(player.UID, { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidBonus } });
            return false;
        }

        return true;
    }

    getJackpot(player) {
        const { finish } = this.gameData.ingame[player.profile.name] ?? {};
        const { jackpot } = finish?.settlementResult ?? { jackpot: { picked: true, prizes: [] } };

        return jackpot;
    }

    isInvalidChest(chest, prizes) {
        return typeof chest !== "number" || chest < 0 || chest >= prizes.length;
    }
}
