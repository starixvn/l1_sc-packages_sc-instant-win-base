import { Core } from "sc-game-base";

export default class SlotGameDefinition extends Core.GameDefinition {
    constructor(
        {
            id = 0,
            name = "",
            durations = {},
            choices = [],
            choicesMapper = {},
            stakeLevels = [],
            freeSpinLiveSeconds = 86400, // 1 day
            bonusSize = 10,
            bonusLiveSeconds = 120,
        },
        generateResult,
        settle,
        roundRepository,
        betRepository,
        betLogRepository,
        freeSpinsRepository,
        famesRepository
    ) {
        super({ id, name, durations, choices, choicesMapper }, generateResult, settle, roundRepository, betRepository, betLogRepository);
        this.freeSpinsRepository = freeSpinsRepository;
        this.famesRepository = famesRepository;
        this.stakeLevels = stakeLevels;
        this.freeSpinLiveSeconds = freeSpinLiveSeconds;
        this.bonusSize = bonusSize;
        this.bonusLiveSeconds = bonusLiveSeconds;
    }
}
