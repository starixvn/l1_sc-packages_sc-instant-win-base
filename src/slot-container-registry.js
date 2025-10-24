import { asClass, asValue } from "awilix";
import { hitJackpot } from "sc-base-apis";
import { gameNotifications } from "sc-base-database";
import { Core, Table } from "sc-game-base";
import * as Board from "./board";
import { SlotGameBot, SlotGameCron, SlotProcessBetQueue } from "./crons";
import * as EventConsumers from "./event-consumers";
import { BonusPublisher, JackpotPublisher } from "./event-publishers";
import { currencyGroupGames, IdCounters, Jackpots } from "./models";
import { HallOfFameQuery, SlotHistoryQuery } from "./query-apis";
import { SlotHttpRouter, SlotSocketRouter } from "./routers";
import SlotGameData from "./slot-game-data";
import SlotGameDefinition from "./slot-game-definition";
import JackpotValidator from "./validators/jackpot-validator";

/**
 * SLOT CONTAINER REGISTRY - Dependency Injection Configuration
 *
 * PURPOSE:
 * Configures the dependency injection container for the slot game module.
 * Registers all game components, services, and utilities with their lifecycles.
 *
 * DEPENDENCY INJECTION BENEFITS:
 * - **Testability**: Easy to mock dependencies for unit testing
 * - **Modularity**: Components can be swapped without code changes
 * - **Lifecycle Management**: Automatic singleton/transient instance management
 * - **Configuration**: Centralized component configuration
 *
 * REGISTRATION PATTERNS:
 * - **asClass()**: Registers constructor functions (classes)
 * - **asValue()**: Registers pre-instantiated objects/constants
 * - **singleton()**: Single shared instance across the application
 * - **proxy()**: Special handling for WebSocket/event-driven components
 */
export default class SlotContainerRegistry extends Table.TableContainerRegistry {
    /**
     * MAIN REGISTRATION ENTRY POINT
     *
     * Orchestrates the complete dependency injection setup for the slot game.
     * Calls parent registration first, then adds slot-specific components.
     *
     * Registration Order:
     * 1. Board utilities (core game logic)
     * 2. Base table game components (inherited)
     * 3. Return configured container
     *
     * @param {Object} appConfigs - Application configuration
     * @param {SlotGameDefinition} definition - Game definition
     * @param {SlotGameData} gameData - Runtime game state
     * @returns {Object} - Configured Awilix container
     */
    register(appConfigs, definition, gameData) {
        // Register slot-specific board components first
        this.registerBoardUtilities();

        // Register base table game components (inherited functionality)
        super.register(appConfigs, definition, gameData);

        return this.container;
    }

    /**
     * REGISTER BOARD UTILITIES - Core Game Logic Components
     *
     * Registers the fundamental components that handle slot game mechanics.
     * These are the core algorithms that determine game outcomes and payouts.
     *
     * Board Components:
     * - **BoardGenerator**: Creates random symbol boards with weighted probabilities
     * - **BonusBoardGenerator**: Generates interactive bonus mini-game prizes
     * - **PaylineCalculator**: Evaluates wins and calculates payouts
     * - **JackpotPrizeGenerator**: Creates jackpot prize wheels
     *
     * All registered as singletons since they contain no state and are thread-safe.
     */
    registerBoardUtilities() {
        // Placeholder for board definition (set at runtime based on difficulty)
        this.container.register({
            boardDefinition: asValue(undefined),
        });

        // Register core board generation and calculation utilities
        this.container.register({
            boardGenerator: asClass(Board.BoardGenerator).singleton(),           // Random board creation
            bonusBoardGenerator: asClass(Board.BonusBoardGenerator).singleton(), // Bonus prize generation
            paylineCalculator: asClass(Board.PaylineCalculator).singleton(),     // Win evaluation engine
            jackpotPrizeGenerator: asClass(Board.JackpotPrizeGenerator).singleton(), // Jackpot wheel creation
        });
    }

    registerModels() {
        super.registerModels();

        this.container.register({
            currencyGroupGamesRepository: asValue(currencyGroupGames()),
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
            progressBonusConsumer: asClass(EventConsumers.ProgressBonusConsumer).singleton(),
            settleGameRoundConsumer: asClass(EventConsumers.SettleGameRoundConsumer).singleton().proxy(),
            jackpotGameConsumer: asClass(EventConsumers.JackpotGameConsumer).singleton().proxy(),
            generateResultConsumer: asClass(EventConsumers.GenerateResultConsumer).singleton().proxy(),
            userSignInConsumer: asClass(EventConsumers.UserSignInConsumer).singleton(),
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

    registerValidators() {
        super.registerValidators();

        this.container.register({
            jackpotValidator: asClass(JackpotValidator).singleton(),
        });
    }
}
