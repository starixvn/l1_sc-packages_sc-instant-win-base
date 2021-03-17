import mongoose from "mongoose";

export default class HallOfFameConsumer {
    /**
     * @param {mongoose.Model} famesRepository
     */
    constructor(famesRepository) {
        this.famesRepository = famesRepository;
    }

    async add(player, { roundId, bet, totalAmount, winningAmount, numberOfPaylines, freeSpin = false }) {
        await this.famesRepository.create({
            uid: player.UID,
            memberId: player.session?.memberId,
            name: player.profile.name,
            roundId,
            bet,
            totalAmount,
            winningAmount,
            numberOfPaylines,
            freeSpin,
            time: new Date(),
        });
    }
}
