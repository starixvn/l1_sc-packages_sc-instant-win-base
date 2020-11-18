import { Core } from "sc-game-base";

import SlotGameBot from "./crons/bot/slot-game-bot";
import SlotGameCron from "./crons/slot-game-cron";
import SlotGameData from "./slot-game-data";
import SlotGameDefinition from "./slot-game-definition";

export default class SlotGameStartup extends Core.BaseStartup {
    /**
     * @param {Object} appConfigs
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     * @param {SlotGameCron} gameCron
     * @param {Core.Cron.ProcessBetQueue} processBetQueue
     * @param {SlotGameBot} bot
     */
    constructor(appConfigs, definition, gameData, gameCron = null, processBetQueue = null, bot = null) {
        super(
            appConfigs,
            definition,
            gameData,
            gameCron ?? new SlotGameCron(definition, gameData, bot),
            processBetQueue ?? new Core.Cron.ProcessBetQueue(definition, gameData)
        );
    }

    /**
     * @param {socketIo.Socket} socketClient
     */
    initSocketRouter(socketClient) {
        const router = new Core.Routers.BaseSocketRouter({ definition: this.definition, gameData: this.gameData });

        router.init(socketClient);
    }

    /**
     * @param {express.Express} app
     */
    initHttpRouter(app) {
        const router = new Core.Routers.HttpRouter(this.gameData);

        router.init(app, this.appConfigs);
    }
}
