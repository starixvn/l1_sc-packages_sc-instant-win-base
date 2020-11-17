import { Core } from "sc-game-base";

import { TableGameCron, TableProcessBetQueue } from "./crons";
import SlotGameBot from "./crons/slot-game-cron";
import { HttpRouter, SocketRouter } from "./routers";
import SlotGameData from "./slot-game-data";
import SlotGameDefinition from "./slot-game-definition";

export default class TableStartup extends Core.BaseStartup {
    /**
     * @param {Object} appConfigs
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {TableGameCron} gameCron
     * @param {Core.Cron.ProcessBetQueue} processBetQueue
     * @param {SlotGameBot} bot
     */
    constructor(appConfigs, definition, gameData, gameCron, processBetQueue, bot = null) {
        super(
            appConfigs,
            definition,
            gameData,
            gameCron ?? new TableGameCron(definition, gameData, bot),
            processBetQueue ?? new TableProcessBetQueue(definition, gameData)
        );
    }

    /**
     * @param {socketIo.Socket} socketClient
     */
    initSocketRouter(socketClient) {
        const router = new SocketRouter({ definition: this.definition, gameData: this.gameData });

        router.init(socketClient);
    }

    /**
     * @param {express.Express} app
     */
    initHttpRouter(app) {
        const router = new HttpRouter(this.gameData);

        router.init(app, this.appConfigs);
    }
}
