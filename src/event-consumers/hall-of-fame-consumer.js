import mongoose from "mongoose";

export default class HallOfFameConsumer {
    /**
     * @param {mongoose.Model} famesRepository
     */
    constructor(famesRepository) {
        this.famesRepository = famesRepository;
    }

    async add(player, { roundId, bet, numberOfPaylines, totalAmount, winningAmount }) {
        await this.famesRepository.create({
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
