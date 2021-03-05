import Chance from "chance";
import moment from "moment";

import { BonusPublisher } from "./../event-publishers";
import SlotNoticeHelper from "./../helpers/slot-notice-helper";
import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";
import SettleGameRoundConsumer from "./settle-game-round-consumer";

export default class BonusConsumer {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {BonusPublisher} bonusPublisher
     * @param {SettleGameRoundConsumer} settleGameRoundConsumer
     */
    constructor(definition, gameData, bonusPublisher, settleGameRoundConsumer) {
        this.definition = definition;
        this.gameData = gameData;
        this.bonusPublisher = bonusPublisher;
        this.settleGameRoundConsumer = settleGameRoundConsumer;

        this.chance = new Chance();
    }

    async consume(player, payload) {
        const { chest } = payload;

        if (!this.validate(player, chest)) {
            return;
        }

        const { bonusChests, finish } = this.gameData.ingame[player.profile.name];

        bonusChests[chest].picked = true;

        this.bonusPublisher.publishBonus(player.UID, { chest, amount: bonusChests[chest].amount });

        if (bonusChests.filter((bonusChest) => bonusChest.picked).length === finish.settlementResult.bonus.odds) {
            await this.settleGameRoundConsumer.autoSettleRound(player, finish.roundId);
        }
    }

    async autoOpenRemainingChests(player) {
        const { finish } = this.gameData.ingame[player.profile.name] ?? {};
        const { bonusChests } = this.gameData.ingame[playerName] ?? {};

        if (finish?.settlementResult) {
            const unpickedChests = bonusChests?.filter((chest) => !chest.picked) ?? [];

            if (unpickedChests.length === 0) {
                return;
            }

            const remainingChests = finish.settlementResult.bonus.odds - (this.definition.bonusSize - unpickedChests.length);
            const autoPickedChests = this.chance.pickset(unpickedChests, remainingChests);

            autoPickedChests.forEach((chest) => {
                const chestIndex = bonusChests.indexOf(chest);

                chest.picked = true;
                this.bonusPublisher.publishBonus(player.UID, { chest: chestIndex, amount: chest.amount });
            });

            await this.settleGameRoundConsumer.autoSettleRound(player, finish.roundId);
        }
    }

    async processExpiredBonus() {
        const expiryTime = moment.utc().subtract(this.definition.bonusLiveSeconds, "seconds").toDate();
        const bets = Object.values(this.gameData.ingame).filter((currentBet) => currentBet.finish?.time < expiryTime);

        await Promise.all(bets.map((bet) => this.autoOpenRemainingChests(bet.player)));
    }

    validate(player, chest) {
        const { bonusChests, finish } = this.gameData.ingame[player.profile.name] ?? { bonusChests: [], finish: {} };
        const totalPicked = (bonusChests?.filter((chest) => chest.picked)?.length ?? 0) + 1;

        const criteria = [
            {
                failure: bonusChests?.length === 0 || (finish?.settlementResult?.bonus && totalPicked > finish.settlementResult.bonus.odds),
                notice: SlotNoticeHelper.invalidBonus,
            },
            {
                failure: typeof chest !== "number" || chest < 0 || chest >= this.definition.bonusSize,
                notice: SlotNoticeHelper.invalidBonus,
            },
            {
                failure: bonusChests && bonusChests[chest]?.picked,
                notice: SlotNoticeHelper.openedBonus,
            },
        ];
        const failedCriterion = criteria.find((criterion) => criterion.failure);

        if (failedCriterion) {
            this.bonusPublisher.publishToUser(player.UID, { endBet: -1, notice: failedCriterion.notice });

            return false;
        }

        return true;
    }
}
