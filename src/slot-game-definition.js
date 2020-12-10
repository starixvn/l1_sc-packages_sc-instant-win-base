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
            freeSpinExpirationHours = 0,
            bonusSize = 10,
            bonusExpirationMinutes = 2,
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
        this.freeSpinExpirationHours = freeSpinExpirationHours;
        this.bonusSize = bonusSize;
        this.bonusExpirationMinutes = bonusExpirationMinutes;
    }
}
