import { Core } from "sc-game-base";

export default class SlotGameDefinition extends Core.GameDefinition {
    constructor(
        {
            id = 0,
            name = "",
            durations = {},
            choices = [],
            choicesMapper = {},
            freeSpinLiveSeconds = 86400, // 1 day
            bonusSize = 10,
            bonusLiveSeconds = 120,
        },
        roundRepository,
        freeSpinsRepository,
        famesRepository
    ) {
        super({ id, name, durations, choices, choicesMapper }, null, null, roundRepository, null, null);
        this.freeSpinsRepository = freeSpinsRepository;
        this.famesRepository = famesRepository;
        this.freeSpinLiveSeconds = freeSpinLiveSeconds;
        this.bonusSize = bonusSize;
        this.bonusLiveSeconds = bonusLiveSeconds;
    }
}
