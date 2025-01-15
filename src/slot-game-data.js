import { Table } from "sc-game-base";

export default class SlotGameData extends Table.TableGameData {
    constructor(remainingTime) {
        super(remainingTime);
        this.freeSpinId = 1;
    }
}
