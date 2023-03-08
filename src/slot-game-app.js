import { Core } from "sc-game-base";
import { Server } from "sc-instrument-helper";
import MsgpackParser from "socket.io-msgpack-parser";
import BaseMetrics from "./base-metrics";

export default class SlotGameApp extends Core.BaseGameApp {
    /**
     *
     * @param {string} serviceName
     * @param {*} appConfigs
     * @param {BaseMetrics} baseMetrics
     */
    constructor(serviceName, appConfigs, baseMetrics = null) {
        this.serviceName = serviceName;
        this.appConfigs = appConfigs;
        this.baseMetrics = baseMetrics ?? new BaseMetrics(appConfigs);
    }

    initSocketServer(httpServer) {
        const { socketOptions, enableCorsWs, corsUrls } = this.appConfigs;
        const opts = socketOptions ?? { pingInterval: 25 * 1000, pingTimeout: 60 * 1000 };
        opts.allowEIO3 = true;
        opts.cors = {
            origin: enableCorsWs ? corsUrls : "*",
            credentials: true,
        };

        if (this.appConfigs.enableMsgpackParser) {
            opts.parser = MsgpackParser;
        }

        return new Server(httpServer, opts);
    }
}
