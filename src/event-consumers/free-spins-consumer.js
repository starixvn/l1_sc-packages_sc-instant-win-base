import { gameNotifications } from "sc-base-database";

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

    async useFreeSpin(player) {
        const firstAvailableFreeSpinSet = this.getSoonestExpiredFreeSpinSet(player);

        if (firstAvailableFreeSpinSet) {
            await this.definition.freeSpinsRepository.update({ id: firstAvailableFreeSpinSet.id }, { $inc: { available: -1 } });
            firstAvailableFreeSpinSet.available--;
        }
    }

    getSoonestExpiredFreeSpinSet(player) {
        const currentDateTime = new Date();
        const freeSpinsOfPlayer = this.gameData.ingame[player.profile.name]?.freeSpins ?? [];

        return freeSpinsOfPlayer.find((freeSpin) => freeSpin.available > 0 && freeSpin.expiryTime > currentDateTime);
    }

    getLatestExpiredFreeSpinSet(player) {
        const currentDateTime = new Date();
        const freeSpinsOfPlayer = this.gameData.ingame[player.profile.name]?.freeSpins ?? [];

        return freeSpinsOfPlayer.reverse().find((freeSpin) => freeSpin.available > 0 && freeSpin.expiryTime > currentDateTime);
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
        const freeSpins = await this.queryFreeSpins();
        const freeSpinsGroupedByNames = this.groupFreeSpinsByNames(freeSpins);
        const freeSpinsGroupedByUIDs = this.groupFreeSpinsByUIDs(freeSpins);

        await this.cleanUpGameNotifications(freeSpinsGroupedByUIDs);

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

    groupFreeSpinsByNames(freeSpins) {
        return freeSpins.reduce((groups, currentFreeSpin) => {
            const cachingFreeSpin = {
                ...currentFreeSpin,
            };

            delete cachingFreeSpin.uid;
            delete cachingFreeSpin.name;

            groups[currentFreeSpin.name] = groups[currentFreeSpin.name] ?? [];
            groups[currentFreeSpin.name].push(cachingFreeSpin);

            return groups;
        }, {});
    }

    groupFreeSpinsByUIDs(freeSpins) {
        return freeSpins.reduce((groups, currentFreeSpin) => {
            const cachingFreeSpin = {
                ...currentFreeSpin,
            };

            delete cachingFreeSpin.uid;
            delete cachingFreeSpin.name;

            groups[currentFreeSpin.uid] = groups[currentFreeSpin.uid] ?? [];
            groups[currentFreeSpin.uid].push(cachingFreeSpin);

            return groups;
        }, {});
    }

    queryFreeSpins() {
        const filter = {
            available: { $gt: 0 },
            expiryTime: { $gt: new Date() },
        };
        const projection = {
            _id: false,
            memberId: false,
            __v: false,
            __archive: false,
        };

        return this.definition.freeSpinsRepository
            .find(filter, projection, { sort: { expiryTime: 1 } })
            .lean()
            .exec();
    }

    async cleanUpGameNotifications(freeSpinsGroupedByUIDs) {
        const excludingUIDs = Object.keys(freeSpinsGroupedByUIDs);

        await gameNotifications.deleteMany({ uid: { $nin: excludingUIDs } });
        await Promise.all(
            Object.entries(freeSpinsGroupedByUIDs).map(async ([uid, freeSpins]) => {
                const filter = {
                    uid,
                    gameId: this.definition.id,
                };
                const latestExpiredFreeSpinSet = freeSpins[freeSpins.length - 1];
                const adjustment = {
                    gameInfo: {
                        freeSpinExpiryTime: latestExpiredFreeSpinSet.expiryTime,
                    },
                };

                await gameNotifications.update(filter, { $set: adjustment }, { upsert: true });
            })
        );
    }
}
