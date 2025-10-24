/**
 * GAME DIFFICULTY LEVELS - RTP Control Constants
 *
 * PURPOSE:
 * Defines the three difficulty levels that control Return to Player (RTP) rates.
 * Each difficulty maps to different symbol weight distributions in default-definition.js.
 *
 * DIFFICULTY MAPPING:
 * - **EASY (1)**: Highest RTP - more frequent wins, player-friendly
 * - **MEDIUM (2)**: Balanced RTP - standard casino odds
 * - **HARD (3)**: Lowest RTP - fewer wins, higher house edge
 *
 * RTP CONTROL:
 * Players can choose their preferred risk/reward level.
 * Higher difficulties provide bigger potential wins but lower overall RTP.
 * Lower difficulties provide more frequent smaller wins.
 *
 * BUSINESS STRATEGY:
 * - Allows players to self-select based on bankroll and risk tolerance
 * - Creates different player segments (casual vs high-rollers)
 * - Provides perceived control while maintaining overall house advantage
 */
export default {
    easy: 1,      // High RTP - frequent wins, lower volatility
    medium: 2,    // Balanced RTP - standard casino odds
    hard: 3,      // Low RTP - rare wins, high volatility
};
