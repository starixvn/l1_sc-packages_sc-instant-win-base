import mongoose from "mongoose";

const modelName = "IdCounter";

/**
 * ID COUNTERS SCHEMA - Auto-Incrementing ID Management
 *
 * PURPOSE:
 * Provides thread-safe, persistent storage for auto-incrementing ID counters.
 * Ensures unique identifiers across the entire game system without conflicts.
 *
 * TECHNICAL APPROACH:
 * - Uses MongoDB's atomic operations for thread safety
 * - Persists counters across server restarts
 * - Supports multiple counter types per game
 * - Optimized for high-frequency ID generation
 *
 * COUNTER STRUCTURE:
 * - c: Current counter value (incremented atomically)
 * - f: Field name (always "id" for our use case)
 * - m: Model identifier (format: "gameName_recordType")
 *
 * USAGE EXAMPLES:
 * - "slot-game_round": Game round IDs
 * - "slot-game_freespin": Free spin record IDs
 * - "slot-game_transaction": Transaction IDs
 *
 * THREAD SAFETY:
 * Atomic increment operations prevent race conditions even with
 * multiple server instances or concurrent requests.
 */
const idCountersSchema = new mongoose.Schema({
    c: { type: Number, required: true, default: 0 },  // Counter value (current ID)
    f: { type: String, required: true },              // Field name (typically "id")
    m: { type: String, required: true },              // Model name (unique key)
});

export default mongoose.model(modelName, idCountersSchema);
