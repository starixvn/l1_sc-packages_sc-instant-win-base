import { Core } from "sc-game-base";

import SlotGameData from "./../../slot-game-data";

export default class SlotGameBot extends Core.Cron.BaseBot {
    /**
     * @param {SlotGameData} gameData
     * @param {Core.BaseEventPublishers.BasePublisher} publisher
     */

    constructor(definition, gameData, publisher) {
        super(definition, gameData, publisher);
    }
}
