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

        app.get(
            "/api/calculate-board",
            utils.authentication.useAuthenticate({
                authUrl: appConfigs.apiSettings.authUrl,
                audiences: appConfigs.authenticateSettings.audiences,
            }),
            (_req, res) => this.handleBoardCalculation(_req.body, res)
        );
    }

    handleSetBoard(params, res) {
        try {
            logger.logWarning(`receive set board results for ${params?.name}`);
            this.gameData.settlementResultFromAdmin[params.name] = params.result;

            res.send({ error: false });
        } catch (error) {
            logger.logError(error);
            res.send({ error: true });
        }
    }

    handleBoardCalculation(params, res) {
        try {
            const paylines = [...Array(this.paylineCalculator.definition.paylines.length).keys()];
            const odds = this.gameData.gameConfigs.slotsConfig.icons;
            const settlementResult = this.paylineCalculator.calculate(params.result, paylines, odds);

            res.send(settlementResult);
        } catch (error) {
            logger.logError(error);
            res.send({ error: true });
        }
    }
}
