import { logger, utils } from "sc-common";
import { Core } from "sc-game-base";

import { PaylineCalculator } from "./../board";
import SlotGameData from "./../slot-game-data";

export default class SlotHttpRouter extends Core.Routers.HttpRouter {
    /**
     * @param {Object} appConfigs
     * @param {SlotGameData} gameData
     * @param {PaylineCalculator} paylineCalculator
     * @param {logger} logService
     */
    constructor(appConfigs, gameData, paylineCalculator, logService) {
        super(appConfigs, gameData);

        this.paylineCalculator = paylineCalculator;
        this.logService = logService;
    }

    init(app) {
        super.init(app);

        app.post(
            "/api/set-board",
            utils.authentication.useAuthenticate({
                authUrl: this.appConfigs.apiSettings.authUrl,
                audiences: this.appConfigs.authenticateSettings.audiences,
            }),
            (_req, res) => this.handleSetBoard(_req.body, res)
        );

        app.post(
            "/api/get-opening-bonus",
            utils.authentication.useAuthenticate({
                authUrl: this.appConfigs.apiSettings.authUrl,
                audiences: this.appConfigs.authenticateSettings.audiences,
            }),
            (_req, res) => this.handleGetOpeningBonus(res)
        );
    }

    handleSetBoard(params, res) {
        try {
            if (!params || !params.name || !params.result) {
                this.logService.logError("receives a result cheating call with invalid params.");
            }

            const paylines = [...Array(this.paylineCalculator.definition.paylines.length).keys()];
            const odds = this.gameData.gameConfigs.slotsConfig.icons;
            const settlementResult = this.paylineCalculator.calculate(params.result, paylines, odds);

            this.logService.logWarning(`receives a result cheating call for ${params?.name} with the board as ${params.result}.`);

            this.gameData.settlementResultFromAdmin[params.name] = params.result;

            res.send(settlementResult);
        } catch (error) {
            this.logService.logError(error);
            res.send({ error: true });
        }
    }

    handleGetOpeningBonus(res) {
        try {
            const usersOpeningBonus = [];
            Object.values(this.gameData.ingame).forEach((playerInGame) => {
                const { bonusChests, player } = playerInGame ?? { player: {}, bonusChests: {} };

                if (bonusChests) {
                    usersOpeningBonus.push(player.profile.name);
                }
            });

            res.send({ usersOpeningBonus });
        } catch (error) {
            this.logService.logError(error);
            res.send({ error: true });
        }
    }
}
