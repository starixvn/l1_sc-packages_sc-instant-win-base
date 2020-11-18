import { Core } from "sc-game-base";

export default class SlotGameCron extends Core.Cron.BaseGameCron {
    constructor(definition, gameData, bot = null, settleGameRoundConsumer = null, gameStatusPublisher = null, runningRoundInfoPublisher = null) {
        super(definition, gameData, bot, settleGameRoundConsumer, gameStatusPublisher, runningRoundInfoPublisher);
    }
}
