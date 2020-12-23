import { logger, utils } from "sc-common";
import { Core } from "sc-game-base";

import { PaylineCalculator } from "./../board";
import SlotGameData from "./../slot-game-data";

export default class SlotHttpRouter extends Core.Routers.HttpRouter {
    /**
     * @param {SlotGameData} gameData
     * @param {PaylineCalculator} paylineCalculator
     */
    constructor(gameData, paylineCalculator = null) {
        super(gameData);

        this.paylineCalculator = paylineCalculator ?? new PaylineCalculator();
    }
    init(app, appConfigs) {
        super.init(app, appConfigs);

        app.post(
            "/api/set-board",
            utils.authentication.useAuthenticate({
                authUrl: appConfigs.apiSettings.authUrl,
                audiences: appConfigs.authenticateSettings.audiences,
            }),
            (_req, res) => this.handleSetBoard(_req.body, res)
        );
    }

    handleSetBoard(params, res) {
        try {
            if (!params || !params.name || !params.result) {
                logger.logError("receives a result cheating call with invalid params.");
            }

            const paylines = [...Array(this.paylineCalculator.definition.paylines.length).keys()];
            const odds = this.gameData.gameConfigs.slotsConfig.icons;
            const settlementResult = this.paylineCalculator.calculate(params.result, paylines, odds);

            logger.logWarning(`receives a result cheating call for ${params?.name} with the board as ${params.result}.`);

            this.gameData.settlementResultFromAdmin[params.name] = params.result;

            res.send(settlementResult);
        } catch (error) {
            logger.logError(error);
            res.send({ error: true });
        }
    }
}
