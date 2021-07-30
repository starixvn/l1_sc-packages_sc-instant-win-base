import mongoose from "mongoose";

import SlotGameData from "./../slot-game-data";

export default class FreeSpinsConsumer {
    /**
     * @param {Number} gameId
     * @param {SlotGameData} gameData
     * @param {mongoose.Model} freeSpinsRepository
     * @param {mongoose.Model} gameNotificationsRepository
     * @param {EventConsumers.IdCountersConsumer} dependencies.idCountersConsumer
     */
    constructor(gameId, gameData, freeSpinsRepository, gameNotificationsRepository, idCountersConsumer) {
        this.gameId = gameId;
        this.gameData = gameData;
        this.freeSpinsRepository = freeSpinsRepository;
        this.gameNotificationsRepository = gameNotificationsRepository;
        this.idCountersConsumer = idCountersConsumer;
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
            await this.freeSpinsRepository.updateOne({ id: firstAvailableFreeSpinSet.id }, { $inc: { available: -1 } });
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

        await this.idCountersConsumer.consume("freespin");
        this.gameData.freeSpinId++;

        const newlyCachedFreeSpin = {
            id: this.gameData.freeSpinId,
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
        const newlyCreatedFreeSpin = await this.freeSpinsRepository.create(gainedFreeSpin);

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
            this.gameData.ingame[name] = this.gameData.ingame[name] ?? { betQueue: [] };
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

        return this.freeSpinsRepository
            .find(filter, projection, { sort: { expiryTime: 1 } })
            .lean()
            .exec();
    }

    async cleanUpGameNotifications(freeSpinsGroupedByUIDs) {
        const excludingUIDs = Object.keys(freeSpinsGroupedByUIDs);

        await this.gameNotificationsRepository.deleteMany({ gameId: this.gameId, uid: { $nin: excludingUIDs } });
        await Promise.all(
            Object.entries(freeSpinsGroupedByUIDs).map(async ([uid, freeSpins]) => {
                const filter = {
                    uid,
                    gameId: this.gameId,
                };
                const latestExpiredFreeSpinSet = freeSpins[freeSpins.length - 1];
                const adjustment = {
                    gameInfo: {
                        freeSpinExpiryTime: latestExpiredFreeSpinSet.expiryTime,
                    },
                };

                await this.gameNotificationsRepository.updateOne(filter, { $set: adjustment }, { upsert: true });
            })
        );
    }

    getTotalAvaiableFreeSpins(player) {
        const { freeSpins } = this.gameData.ingame[player.profile.name] ?? {};

        return freeSpins?.reduce((total, freeSpin) => total + freeSpin.available, 0) ?? 0;
    }
}
