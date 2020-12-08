import { Core } from "sc-game-base";

export default class HallOfFameConsumer {
    /**
     * @param {Core.GameDefinition} definition
     */
    constructor(definition) {
        this.definition = definition;
    }

    async add(player, { roundId, bet, numberOfPaylines, totalAmount }) {
        await this.famesRepository.create({
            uid: player.UID,
            memberId: player.session?.memberId,
            name: player.profile.name,
            roundId,
            bet,
            totalAmount,
            numberOfPaylines,
            time: new Date(),
        });
    }
}
