import { Core } from "sc-game-base";

import SlotGameStartup from "./slot-game-startup";

export default class SlotGameApp extends Core.BaseGameApp {
    constructor(appConfigs, definition, gameData, startup) {
        super(appConfigs, definition, gameData, startup ?? new SlotGameStartup(appConfigs, definition, gameData));
    }
}
