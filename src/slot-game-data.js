import { Core } from "sc-game-base";

export default class SlotGameData extends Core.GameData {
    constructor(remainingTime) {
        super(remainingTime);
        this.freeSpinId = 1;
    }
}
