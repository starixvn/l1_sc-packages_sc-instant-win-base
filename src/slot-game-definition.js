import { Table } from "sc-game-base";

export default class SlotGameDefinition extends Table.TableGameDefinition {
    constructor({
        id = 0,
        name = "",
        durations = {},
        choices = [],
        choicesMapper = {},
        historyPageSize = 8,
        freeSpinLiveSeconds = 86400, // 1 day
        bonusSize = 10,
        bonusLiveSeconds = 125,
        jackpotLiveSeconds = 65,
        delaySecondsAfterJackpot = 2,
        applyNewBonusCalculation = false,
    }) {
        super({ id, name, durations, choices, choicesMapper, historyPageSize }, null, null);
        this.freeSpinLiveSeconds = freeSpinLiveSeconds;
        this.bonusSize = bonusSize;
        this.bonusLiveSeconds = bonusLiveSeconds;
        this.jackpotLiveSeconds = jackpotLiveSeconds;
        this.applyNewBonusCalculation = applyNewBonusCalculation;
        this.delaySecondsAfterJackpot = delaySecondsAfterJackpot;
    }
}
