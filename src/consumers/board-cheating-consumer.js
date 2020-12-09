import SlotGameData from "./../slot-game-data";

export default class FreeSpinsConsumer {
    /**
     * @param {SlotGameData} gameData
     */
    constructor(gameData) {
        this.gameData = gameData;
    }

    consume(name, board) {
        const resultFromAdmin = this.gameData.settlementResultFromAdmin[name];
        const finalResult = board;

        if (resultFromAdmin) {
            delete this.gameData.settlementResultFromAdmin[name];

            finalResult = resultFromAdmin ?? finalResult;
        }

        return finalResult;
    }
}
