import mongoose from "mongoose";

import SlotGameData from "./../slot-game-data";

/**
 * FREE SPINS CONSUMER - Free Spins Feature Manager
 *
 * PURPOSE:
 * Manages the free spins feature where players get additional spins without betting.
 * Free spins are awarded for landing bonus symbols and provide risk-free gameplay.
 *
 * FREE SPINS LIFECYCLE:
 * 1. Player lands free spin symbols → Awarded free spins with time limit
 * 2. Free spins are stored and tracked per player
 * 3. Player can use free spins instead of regular bets
 * 4. Free spins expire after 24 hours (configurable)
 * 5. Multiple free spin sets can stack per player
 *
 * BUSINESS VALUE:
 * - Rewards player engagement with bonus gameplay
 * - Allows players to continue playing without additional cost
 * - Increases session time and revenue potential
 * - Provides recovery mechanism for losing streaks
 */
export default class FreeSpinsConsumer {
    /**
     * @param {Number} gameId
     * @param {SlotGameData} gameData
     * @param {mongoose.Model} freeSpinsRepository
     * @param {mongoose.Model} gameNotificationsRepository
     * @param {EventConsumers.IdCountersConsumer} dependencies.idCountersConsumer
     */
    /**
     * @param {Number} gameId - Unique identifier for this game
     * @param {SlotGameData} gameData - Runtime game state
     * @param {mongoose.Model} freeSpinsRepository - Database model for free spins
     * @param {mongoose.Model} gameNotificationsRepository - Database model for notifications
     * @param {Object} idCountersConsumer - ID generator for free spin records
     */
    constructor(gameId, gameData, freeSpinsRepository, gameNotificationsRepository, idCountersConsumer) {
        this.gameId = gameId;
        this.gameData = gameData;
        this.freeSpinsRepository = freeSpinsRepository;
        this.gameNotificationsRepository = gameNotificationsRepository;
        this.idCountersConsumer = idCountersConsumer;
    }

    /**
     * CHECK IF PLAYER HAS AVAILABLE FREE SPINS
     *
     * Determines if a player has any free spins they can currently use.
     * Checks both availability count and expiration time.
     *
     * @param {Object} player - Player session data
     * @returns {boolean} - True if player has available free spins
     */
    hasFreeSpin(player) {
        const freeSpinsOfPlayer = this.gameData.ingame[player.profile.name]?.freeSpins;

        if (freeSpinsOfPlayer && freeSpinsOfPlayer.length > 0) {
            const currentDateTime = new Date();

            // Check if any free spin set has available spins and hasn't expired
            return freeSpinsOfPlayer.some((freeSpin) =>
                freeSpin.available > 0 && freeSpin.expiryTime > currentDateTime
            );
        }

        return false;
    }

    /**
     * CONSUME ONE FREE SPIN - Use Free Spin for Gameplay
     *
     * Deducts one free spin from player's available balance.
     * Uses the free spin set that expires soonest (FIFO principle).
     *
     * @param {Object} player - Player session data
     */
    async useFreeSpin(player) {
        // Get the free spin set that expires soonest
        const firstAvailableFreeSpinSet = this.getSoonestExpiredFreeSpinSet(player);

        if (firstAvailableFreeSpinSet) {
            // Atomically decrement available count in database
            await this.freeSpinsRepository.updateOne(
                { id: firstAvailableFreeSpinSet.id },
                { $inc: { available: -1 } }
            );

            // Update in-memory cache
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

    /**
     * AWARD FREE SPINS TO PLAYER
     *
     * Grants free spins when player lands free spin symbols.
     * Creates persistent database record and in-memory cache.
     *
     * Free Spin Creation Process:
     * 1. Generate unique ID for the free spin set
     * 2. Set expiration time (24 hours default)
     * 3. Store in database with player association
     * 4. Cache in memory for fast access
     * 5. Update game notifications for client
     *
     * @param {Object} player - Player session data
     * @param {Object} params - Free spin parameters
     * @param {number} params.roundId - Round where free spins were earned
     * @param {number} params.bet - Bet amount per spin
     * @param {Array} params.paylines - Active paylines configuration
     * @param {number} params.numberOfFreeSpins - How many free spins to award
     * @param {number} timeToLive - Seconds until expiration (default 86400 = 24 hours)
     */
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
            name: memberName,
            playerId: player.session?.playerId,
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
            playerId: false,
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
