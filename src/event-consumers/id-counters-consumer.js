import mongoose from "mongoose";

/**
 * ID COUNTERS CONSUMER - Auto-Incrementing ID Generation
 *
 * PURPOSE:
 * Provides thread-safe, auto-incrementing ID generation for database records.
 * Ensures unique identifiers across the entire game system without conflicts.
 *
 * ID GENERATION STRATEGY:
 * - Uses MongoDB atomic operations for thread safety
 * - Maintains separate counters for different record types
 * - Supports both incrementing and setting specific values
 * - Persists counters across server restarts
 *
 * TYPICAL USAGE:
 * - Round IDs: incrementing game round numbers
 * - Free spin IDs: unique free spin set identifiers
 * - Any sequential ID requirements in the game
 */
export default class IdCountersConsumer {
    /**
     * @param {String} gameName
     * @param {mongoose.Model} idCountersRepository
     */
    /**
     * @param {string} gameName - Name of the game (e.g., "slot-game")
     * @param {mongoose.Model} idCountersRepository - Database model for ID counters
     */
    constructor(gameName, idCountersRepository) {
        this.gameName = gameName;
        this.idCountersRepository = idCountersRepository;
    }

    /**
     * GENERATE NEXT UNIQUE ID - Atomic Increment
     *
     * Thread-safe method to get the next available ID for a given record type.
     * Uses MongoDB's atomic findOneAndUpdate to prevent race conditions.
     *
     * ID Format: {gameName}_{modelNamePostFix}
     * Example: "slot-game_round" → generates incrementing round IDs
     *
     * @param {string} modelNamePostFix - Record type identifier (e.g., "round", "freespin")
     * @returns {number} - Next available unique ID
     */
    async consume(modelNamePostFix) {
        // Create unique counter key for this game and record type
        const filter = {
            m: `${this.gameName}_${modelNamePostFix}`,  // model name (unique key)
            f: "id",                                     // field name (always "id")
        };

        // Atomic increment operation
        const increment = { $inc: { c: 1 } };  // increment counter by 1

        // MongoDB options for atomic operation
        const updateOptions = {
            new: true,                // Return updated document
            lean: true,              // Fast query without mongoose overhead
            setDefaultsOnInsert: true, // Create document if it doesn't exist
            upsert: true,            // Insert if not found
            fields: { c: 1 },        // Only return counter field
        };

        // Atomic operation - thread safe even with concurrent requests
        const latestCounter = await this.idCountersRepository.findOneAndUpdate(
            filter,
            increment,
            updateOptions
        );

        return latestCounter.c;  // Return the new counter value
    }

    /**
     * GET CURRENT COUNTER VALUE - Read-Only Access
     *
     * Retrieves the current value of a counter without incrementing it.
     * Used for initialization and synchronization purposes.
     *
     * @param {string} modelNamePostFix - Record type identifier
     * @returns {number} - Current counter value or 0 if not found
     */
    async getLatestId(modelNamePostFix) {
        const latestCounter = await this.idCountersRepository
            .findOne(
                { m: `${this.gameName}_${modelNamePostFix}` },  // Find counter document
                "c"  // Only return counter field
            )
            .lean()  // Fast query
            .exec();

        return latestCounter?.c ?? 0;  // Return counter value or 0 if not found
    }

    /**
     * SET COUNTER VALUE - Direct Assignment
     *
     * Manually sets a counter to a specific value.
     * Used during system initialization or recovery from backups.
     *
     * WARNING: This can cause ID conflicts if not used carefully!
     * Only use for system maintenance or initialization.
     *
     * @param {string} modelNamePostFix - Record type identifier
     * @param {number} id - Value to set the counter to
     */
    async updateLatestId(modelNamePostFix, id) {
        // Find the counter document
        const filter = {
            m: `${this.gameName}_${modelNamePostFix}`,
            f: "id",
        };

        // Set counter to specific value
        const updates = {
            $set: { c: id },
        };

        // Create document if it doesn't exist
        const updateOptions = {
            setDefaultsOnInsert: true,
            upsert: true,
        };

        await this.idCountersRepository.findOneAndUpdate(filter, updates, updateOptions);
    }
}
