import { Core } from "sc-game-base";

import { SlotGameBot, SlotGameCron, SlotProcessBetQueue } from "./crons";
import { SlotSocketRouter } from "./routers";
import SlotGameData from "./slot-game-data";
import SlotGameDefinition from "./slot-game-definition";

export default class SlotGameStartup extends Core.BaseStartup {
    /**
     * @param {Object} appConfigs
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {SlotGameCron} gameCron
     * @param {SlotProcessBetQueue} processBetQueue
     * @param {SlotGameBot} bot
     */
    constructor(appConfigs, definition, gameData, gameCron = null, processBetQueue = null, bot = null) {
        super(
            appConfigs,
            definition,
            gameData,
            gameCron ?? new SlotGameCron(definition, gameData, bot),
            processBetQueue ?? new SlotProcessBetQueue(definition, gameData)
        );
    }

    /**
     * @param {socketIo.Socket} socketClient
     */
    initSocketRouter(socketClient) {
        const router = new SlotSocketRouter({ definition: this.definition, gameData: this.gameData });

        router.init(socketClient);
    }
}
