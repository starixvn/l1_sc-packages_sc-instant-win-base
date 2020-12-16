import SlotGameData from "../slot-game-data";

export default class BoardCheatingConsumer {
    /**
     * @param {SlotGameData} gameData
     */
    constructor(gameData) {
        this.gameData = gameData;
    }

    consume(name, board) {
        const resultFromAdmin = this.gameData.settlementResultFromAdmin[name];
        let finalResult = board;

        if (resultFromAdmin) {
            delete this.gameData.settlementResultFromAdmin[name];

            finalResult = resultFromAdmin ?? finalResult;
        }

        return finalResult;
    }
}
