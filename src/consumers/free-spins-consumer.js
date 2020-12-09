import SlotGameData from "./../slot-game-data";
import SlotGameDefinition from "./../slot-game-definition";

export default class FreeSpinsConsumer {
    /**
     * @param {SlotGameDefinition} definition
     * @param {SlotGameData} gameData
     */
    constructor(definition, gameData) {
        this.definition = definition;
        this.gameData = gameData;
    }

    hasFreeSpin(player) {
        const freeSpinsOfPlayer = this.gameData.ingame[player.profile.name]?.freeSpins;

        if (freeSpinsOfPlayer && freeSpinsOfPlayer.length > 0) {
            const currentDateTime = new Date();

            return freeSpinsOfPlayer.some((freeSpin) => freeSpin.expiryDate > currentDateTime);
        }

        return false;
    }

    async useFreeSpin(player) {
        const freeSpinsOfPlayer = this.gameData.ingame[player.profile.name]?.freeSpins ?? [];
        const currentDateTime = new Date();
        const firstAvailableFreeSpinSet = freeSpinsOfPlayer.find((freeSpin) => freeSpin.available > 0 && freeSpin.expiryDate > currentDateTime);

        await this.definition.freeSpinsRepository.update({ id: firstAvailableFreeSpinSet.id }, { $inc: { available: -1 } });
        firstAvailableFreeSpinSet.available--;

        return {
            bet: firstAvailableFreeSpinSet.bet,
            paylines: firstAvailableFreeSpinSet.paylines,
        };
    }

    async gainFreeSpin(player, { roundId, bet, paylines, numberOfFreeSpins }, timeToLive) {
        const createdTime = new Date();
        const newlyCachedFreeSpin = {
            roundId,
            bet,
            paylines,
            total: numberOfFreeSpins,
            available: numberOfFreeSpins,
            time: createdTime,
            expiryDate: new Date().setSeconds(createdTime.getSeconds() + timeToLive),
        };
        const gainedFreeSpin = {
            uid: player.UID,
            memberId: player.session?.memberId,
            name: player.profile.name,
            ...newlyCachedFreeSpin,
        };
        const newlyCreatedFreeSpin = await this.definition.freeSpinsRepository.create(gainedFreeSpin);

        newlyCachedFreeSpin.id = newlyCreatedFreeSpin.id;
        this.gameData.ingame[bet.name].freeSpins = this.gameData.ingame[bet.name].freeSpins ?? [];

        this.gameData.ingame[bet.name].freeSpins.push(newlyCachedFreeSpin);
    }

    async reload() {
        const freeSpinsGroupedByNames = await this.loadMembersFreeSpins();

        Object.entries(this.gameData.ingame).forEach(([name, ingameData]) => {
            delete ingameData.freeSpin;

            ingameData.freeSpin = freeSpinsGroupedByNames[name] ?? [];
        });
    }

    async loadMembersFreeSpins() {
        const filter = {
            available: { $gt: 0 },
            expiryDate: { $gt: new Date() },
        };
        const projection = {
            _id: false,
            uid: false,
            memberId: false,
            __v: false,
            __archive: false,
        };
        const freeSpins = await this.definition.freeSpinsRepository
            .find(filter, projection, { sort: { expiryDate: 1 } })
            .lean()
            .exec();

        return freeSpins.reduce((groups, currentFreeSpin) => {
            const cachingFreeSpin = {
                ...currentFreeSpin,
            };

            delete cachingFreeSpin.name;

            groups[currentFreeSpin.name] = groups[currentFreeSpin.name] ?? [];
            groups[currentFreeSpin.name].push(cachingFreeSpin);

            return groups;
        }, {});
    }
}
