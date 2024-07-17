import { Core } from "sc-game-base";

export default class SlotGameDefinition extends Core.GameDefinition {
    constructor({
        id = 0,
        name = "",
        durations = {},
        choices = [],
        choicesMapper = {},
        historyPageSize = 10,
        freeSpinLiveSeconds = 86400, // 1 day
        bonusSize = 10,
        bonusLiveSeconds = 120,
        jackpotLiveSeconds = 120,
        applyNewBonusCalculation = false,
    }) {
        super({ id, name, durations, choices, choicesMapper, historyPageSize }, null, null);
        this.freeSpinLiveSeconds = freeSpinLiveSeconds;
        this.bonusSize = bonusSize;
        this.bonusLiveSeconds = bonusLiveSeconds;
        this.jackpotLiveSeconds = jackpotLiveSeconds;
        this.applyNewBonusCalculation = applyNewBonusCalculation;
    }
}
