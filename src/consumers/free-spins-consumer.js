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

            return freeSpinsOfPlayer.some((freeSpin) => freeSpin.available > 0 && freeSpin.expiryTime > currentDateTime);
        }

        return false;
    }

    async getFreeSpin(player) {
        const firstAvailableFreeSpinSet = this.getFirstAvailableFreeSpinSet(player);

        if (firstAvailableFreeSpinSet) {
            return {
                bet: firstAvailableFreeSpinSet.bet,
                paylines: firstAvailableFreeSpinSet.paylines,
            };
        }

        return {
            bet: 0,
            paylines: [],
        };
    }

    async useFreeSpin(player) {
        const firstAvailableFreeSpinSet = this.getFirstAvailableFreeSpinSet(player);

        if (firstAvailableFreeSpinSet) {
            await this.definition.freeSpinsRepository.update({ id: firstAvailableFreeSpinSet.id }, { $inc: { available: -1 } });
            firstAvailableFreeSpinSet.available--;
        }
    }

    getFirstAvailableFreeSpinSet(player) {
        const currentDateTime = new Date();
        const freeSpinsOfPlayer = this.gameData.ingame[player.profile.name]?.freeSpins ?? [];

        return freeSpinsOfPlayer.find((freeSpin) => freeSpin.available > 0 && freeSpin.expiryTime > currentDateTime);
    }

    async gainFreeSpin(player, { roundId, bet, paylines, numberOfFreeSpins }, timeToLive) {
        const createdTime = new Date();
        const expiryTime = new Date(createdTime.getTime()).setSeconds(createdTime.getSeconds() + timeToLive);
        const memberName = player.profile.name;
        const newlyCachedFreeSpin = {
            roundId,
            bet,
            paylines,
            total: numberOfFreeSpins,
            available: numberOfFreeSpins,
            time: createdTime,
            expiryTime,
        };
        const gainedFreeSpin = {
            uid: player.UID,
            memberId: player.session?.memberId,
            name: memberName,
            ...newlyCachedFreeSpin,
        };
        const newlyCreatedFreeSpin = await this.definition.freeSpinsRepository.create(gainedFreeSpin);

        if (newlyCreatedFreeSpin) {
            newlyCachedFreeSpin.id = newlyCreatedFreeSpin.id;
            this.gameData.ingame[memberName].freeSpins = this.gameData.ingame[memberName].freeSpins ?? [];

            this.gameData.ingame[memberName].freeSpins.push(newlyCachedFreeSpin);
        }
    }

    async reload() {
        const freeSpinsGroupedByNames = await this.loadMembersFreeSpins();

        Object.entries(this.gameData.ingame).forEach(([name, ingameData]) => {
            const loadedFreeSpins = freeSpinsGroupedByNames[name] ?? [];

            delete ingameData.freeSpins;
            delete freeSpinsGroupedByNames[name];

            ingameData.freeSpins = loadedFreeSpins;
        });

        Object.entries(freeSpinsGroupedByNames).forEach(([name, loadedFreeSpins]) => {
            this.gameData.ingame[name] = this.gameData.ingame[name] ?? {};
            this.gameData.ingame[name].freeSpins = loadedFreeSpins ?? [];
        });
    }

    async loadMembersFreeSpins() {
        const filter = {
            available: { $gt: 0 },
            expiryTime: { $gt: new Date() },
        };
        const projection = {
            _id: false,
            uid: false,
            memberId: false,
            __v: false,
            __archive: false,
        };
        const freeSpins = await this.definition.freeSpinsRepository
            .find(filter, projection, { sort: { expiryTime: 1 } })
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
