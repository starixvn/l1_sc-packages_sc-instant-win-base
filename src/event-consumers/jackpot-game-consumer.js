import Chance from "chance";
import moment from "moment";

import { JackpotPublisher } from "./../event-publishers";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
import SettleGameRoundConsumer from "./settle-game-round-consumer";

export default class BonusConsumer {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {JackpotPublisher} jackpotPublisher
     * @param {SettleGameRoundConsumer} settleGameRoundConsumer
     * @param {mongoose.Model} dependencies.roundsRepository
     */
    constructor(definition, gameData, jackpotPublisher, settleGameRoundConsumer, roundsRepository) {
        this.definition = definition;
        this.gameData = gameData;
        this.jackpotPublisher = jackpotPublisher;
        this.settleGameRoundConsumer = settleGameRoundConsumer;
        this.roundsRepository = roundsRepository;

        this.chance = new Chance();
    }

    async consume(player, payload) {
        const { chest } = payload;

        if (!this.validate(player, chest)) {
            return;
        }

        const bet = await this.roundsRepository.findOneAndUpdate(
            { playerId: player.session.playerId, paid: false, jackpot: { picked: false } },
            { $set: { jackpot: { picked: true } } },
            {
                new: true,
                lean: true,
            }
        );

        const { jackpot } = this.gameData.ingame[player.profile.name];
        jackpot.picked = true;

        const { winningAmount, winningLine } = await this.settleGameRoundConsumer.processJackpot(player, finish.roundId, bet, jackpot.winningLine);

        //TODO update bet
    }

    //TODO auto settle all jackpot when service restart
    async processExpired() {
        //TODO how to check jp is expired?
    }

    validate(player, chest) {
        const { jackpot } = this.gameData.ingame[player.profile.name] ?? { jackpot: { paid: true, prizes: [] } };

        if (jackpot.paid || this.isInvalidChest(chest, jackpot.prizes)) {
            this.jackpotPublisher.publishToUser(player.UID, { endBet: -1, notice: { errorCode: SlotNoticeHelper.invalidBonus } });
            return false;
        }

        return true;
    }

    isInvalidChest(prizes) {
        return typeof chest !== "number" || chest < 0 || chest >= prizes.length;
    }
}
