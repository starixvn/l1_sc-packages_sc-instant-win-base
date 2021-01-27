import awilix from "awilix";
import { hitJackpot } from "sc-base-apis";
import { gameNotifications } from "sc-base-database";
import { Core, Table } from "sc-game-base";

import * as Board from "./board";
import { SlotGameBot, SlotGameCron, SlotProcessBetQueue } from "./crons";
import * as EventConsumers from "./event-consumers";
import { BonusPublisher, JackpotPublisher } from "./event-publishers";
import { IdCounters, Jackpots } from "./models";
import { HallOfFameQuery, SlotHistoryQuery } from "./query-apis";
import { SlotHttpRouter, SlotSocketRouter } from "./routers";
import SlotGameData from "./slot-game-data";
import SlotGameDefinition from "./slot-game-definition";

const { asClass, asValue } = awilix;

export default class SlotContainerRegistry extends Table.TableContainerRegistry {
    /**
     * @param {Object} appConfigs
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     */
    register(appConfigs, definition, gameData) {
        this.registerBoardUtilities();

        super.register(appConfigs, definition, gameData);

        return this.container;
    }

    registerBoardUtilities() {
        this.container.register({
            boardDefinition: asValue(undefined),
        });

        this.container.register({
            boardGenerator: asClass(Board.BoardGenerator).singleton(),
            bonusBoardGenerator: asClass(Board.BonusBoardGenerator).singleton(),
            paylineCalculator: asClass(Board.PaylineCalculator).singleton(),
        });
    }

    registerModels() {
        super.registerModels();

        this.container.register({
            jackpotsRepository: asValue(Jackpots),
            idCountersRepository: asValue(IdCounters),
            gameNotificationsRepository: asValue(gameNotifications),
        });

        this.container.register({
            famesRepository: asValue(undefined),
            freeSpinsRepository: asValue(undefined),
        });
    }

    registerApis() {
        super.registerApis();

        this.container.register({
            hitJackpot: asValue(hitJackpot),
            historyQuery: asClass(SlotHistoryQuery).singleton(),
            hallOfFameQuery: asClass(HallOfFameQuery).singleton(),
        });
    }

    registerPublishers() {
        super.registerPublishers();

        this.container.register({
            placeBetPublisher: asClass(Core.BaseEventPublishers.PlaceBetPublisher).singleton(),
            jackpotPublisher: asClass(JackpotPublisher).singleton(),
            bonusPublisher: asClass(BonusPublisher).singleton(),
        });
    }

    registerConsumers() {
        super.registerConsumers();

        this.container.register({
            boardCheatingConsumer: asClass(EventConsumers.BoardCheatingConsumer).singleton(),
            bonusConsumer: asClass(EventConsumers.BonusConsumer).singleton(),
            freeSpinsConsumer: asClass(EventConsumers.FreeSpinsConsumer).singleton(),
            hallOfFameConsumer: asClass(EventConsumers.HallOfFameConsumer).singleton(),
            idCountersConsumer: asClass(EventConsumers.IdCountersConsumer).singleton(),
            inGameConsumer: asClass(EventConsumers.InGameConsumer).singleton().proxy(),
            jackpotConsumer: asClass(EventConsumers.JackpotConsumer).singleton(),
            userDisconnectConsumer: asClass(EventConsumers.OutGameConsumer).singleton(),
            placeBetConsumer: asClass(EventConsumers.PlaceBetConsumer).singleton(),
            settleGameRoundConsumer: asClass(EventConsumers.SettleGameRoundConsumer).singleton().proxy(),
        });
    }

    registerCrons() {
        super.registerCrons();

        this.container.register({
            bot: asClass(SlotGameBot).singleton().proxy(),
            gameCron: asClass(SlotGameCron).singleton().proxy(),
            processBetQueue: asClass(SlotProcessBetQueue).singleton().proxy(),
        });
    }

    registerRouters() {
        super.registerRouters();

        this.container.register({
            socketRouter: asClass(SlotSocketRouter).proxy(),
            httpRouter: asClass(SlotHttpRouter),
        });
    }
}
