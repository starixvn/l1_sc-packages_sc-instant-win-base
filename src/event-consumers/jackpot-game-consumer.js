import Chance from "chance";
import moment from "moment";

import { JackpotPublisher } from "./../event-publishers";
import SlotNoticeHelper from "./../helpers/slot-notice-helper";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
import SettleGameRoundConsumer from "./settle-game-round-consumer";

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

    async consume(player, payload) {
        const { chest } = payload;

        if (!this.validate(player, chest)) {
            return;
        }

        const { bet } = await this.pickJackpotAndUpdateBet({ player, chest });

        if (!bet) {
            this.jackpotPublisher.publishToUser(player.UID, { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidJackpot } });
            return;
        }

        await this.settleGameRoundConsumer.settleWithJackpotWin({ player, roundId: bet.id });
    }

    async pickJackpotAndUpdateBet({ player, chest }) {
        const jackpot = this.getJackpot(player);

        if (jackpot && jackpot.prizes?.length > 0) {
            if (!chest) {
                chest = this.chance.integer({ min: 0, max: jackpot.prizes.length - 1 });
            }

            const bet = await this.roundsRepository.findOneAndUpdate(
                { playerId: player.session.playerId, paid: false, "settlementResult.jackpot.picked": false },
                { $set: { "settlementResult.jackpot.picked": true, "settlementResult.jackpot.winningPrize": jackpot.prizes[chest] } },
                {
                    new: true,
                    lean: true,
                }
            );

            if (bet) {
                jackpot.picked = true;

                return { bet, winningPrize: jackpot.prizes[chest] };
            }
        }

        return { bet: null, winningPrize: null };
    }

    async processExpired() {
        const expiryTime = moment.utc().subtract(this.definition.jackpotLiveSeconds, "seconds").toDate();

        try {
            const runningBets = Object.values(this.gameData.ingame).filter(
                (currentBet) => currentBet.finish && currentBet.finish?.time < expiryTime && this.isHavingJackpot(currentBet)
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
        const { bet } = await this.pickJackpotAndUpdateBet({ player });

        if (!bet) {
            return;
        }

        await this.settleGameRoundConsumer.settleWithJackpotWin({ player, roundId: bet.id });
    }

    isHavingJackpot(bet) {
        if (bet.finish?.settlementResult) {
            const { jackpot } = bet.finish.settlementResult;

            return jackpot ? jackpot.winningLine > 0 && !jackpot.picked : false;
        }

        return false;
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
