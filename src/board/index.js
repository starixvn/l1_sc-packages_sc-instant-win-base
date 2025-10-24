/**
 * BOARD MODULE BARREL EXPORT
 *
 * PURPOSE:
 * Central export point for all board-related game logic components.
 * Provides clean, organized access to core slot machine algorithms.
 *
 * EXPORTED COMPONENTS:
 *
 * BoardGenerator:
 * - Generates random 5x3 symbol boards with weighted probability distributions
 * - Implements RTP control through difficulty-based symbol frequencies
 * - Supports both human players and automated bot gameplay
 *
 * BonusBoardGenerator:
 * - Creates interactive bonus mini-game prize chests
 * - Applies payline-based scaling for fair prize distribution
 * - Supports both legacy and enhanced calculation methods
 *
 * PaylineCalculator:
 * - Evaluates all 25 paylines for winning combinations
 * - Handles wild symbol substitution logic
 * - Implements profit optimization across multiple winning lines
 * - Detects special feature triggers (jackpots, bonuses, free spins)
 *
 * JackpotPrizeGenerator:
 * - Creates prize wheels for progressive jackpot wins
 * - Applies weighted distribution based on player allocation settings
 * - Ensures fair prize tier selection with configurable probabilities
 *
 * USAGE:
 * import { BoardGenerator, PaylineCalculator } from './board';
 *
 * This barrel export enables clean imports and maintains module organization
 * while keeping the board logic components logically grouped together.
 */

import BoardGenerator from "./board-generator";
import BonusBoardGenerator from "./bonus-board-generator";
import PaylineCalculator from "./payline-calculator";
import JackpotPrizeGenerator from "./jackpot-prize-generator";

export { BoardGenerator, BonusBoardGenerator, PaylineCalculator, JackpotPrizeGenerator };
