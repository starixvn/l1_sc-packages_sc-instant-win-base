import { logger, utils } from "sc-common";
import { Core } from "sc-game-base";

export default class SlotHttpRouter extends Core.Routers.HttpRouter {
    init(app, appConfigs) {
        app.post(
            "/api/set-board",
            utils.authentication.useAuthenticate({
                authUrl: appConfigs.apiSettings.authUrl,
                audiences: appConfigs.authenticateSettings.audiences,
            }),
            (_req, res) => this.handleSetBoard(_req.body, res)
        );

        super.init(app, appConfigs);
    }

    handleSetBoard(params, res) {
        try {
            this.gameData.settlementResultFromAdmin[params.name] = params.result;
        } catch (error) {
            logger.logError(error);
            res.send({ error: true });
        }
    }
}
