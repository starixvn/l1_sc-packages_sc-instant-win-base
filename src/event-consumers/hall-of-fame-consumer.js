import SlotGameDefinition from "../slot-game-definition";

export default class HallOfFameConsumer {
    /**
     * @param {SlotGameDefinition} definition
     */
    constructor(definition) {
        this.definition = definition;
    }

    async add(player, { roundId, bet, numberOfPaylines, totalAmount, winningAmount }) {
        await this.definition.famesRepository.create({
            uid: player.UID,
            memberId: player.session?.memberId,
            name: player.profile.name,
            roundId,
            bet,
            totalAmount,
            winningAmount,
            numberOfPaylines,
            time: new Date(),
        });
    }
}
