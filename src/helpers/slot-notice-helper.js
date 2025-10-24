/**
 * SLOT NOTICE HELPER - Standardized Error Codes
 *
 * PURPOSE:
 * Provides consistent error code mappings for slot game validation failures.
 * These codes are sent to clients to display appropriate error messages.
 *
 * ERROR CODE CONVENTIONS:
 * - **SB**** prefix indicates Slot Bonus system
 * - **1928-1932**: General slot validation errors
 * - **1940-1941**: Jackpot-specific errors
 *
 * USAGE:
 * When validation fails, return an object with:
 * { failure: true, errorCode: SlotNoticeHelper.invalidStakeLevel }
 *
 * CLIENT INTEGRATION:
 * Clients map these codes to localized error messages for user display.
 */
export default {
    // GENERAL SLOT ERRORS
    invalidPaylines: "SB1928",    // Invalid payline selection
    invalidFreeSpin: "SB1929",    // Free spin usage not allowed
    invalidStakeLevel: "SB1930",  // Bet amount not in allowed levels
    invalidBonus: "SB1931",       // Invalid bonus chest operation
    openedBonus: "SB1932",        // Attempted to open already opened chest

    // JACKPOT ERRORS
    invalidJackpot: "SB1940",     // Invalid jackpot game operation
    openedJackpot: "SB1941",      // Attempted to open already opened jackpot
};
