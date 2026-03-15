import { TimeDeposit } from '../../TimeDeposit';

/**
 * Port: Interest calculation strategy interface.
 *
 * Each plan type implements this interface to encapsulate its own interest
 * calculation rules. This follows the Strategy Pattern (GoF) and adheres to:
 *   - SRP: Each strategy handles exactly one plan type's interest logic.
 *   - OCP: New plan types can be added by implementing this interface
 *          and registering in the InterestStrategyRegistry — no existing
 *          code needs modification.
 *   - ISP: The interface is minimal — a single method.
 *   - DIP: The calculator depends on this abstraction, not concrete strategies.
 *
 * Design assumptions (documented per requirement):
 *   - "No interest for the first 30 days" applies universally to ALL plan types.
 *     This is enforced at the strategy level so each strategy is self-contained,
 *     but the base threshold (30 days) is a shared constant.
 *   - Interest is calculated monthly: (balance × annualRate) / 12
 *   - The method returns the raw interest amount (before rounding).
 *     Rounding to 2 decimal places is the caller's responsibility to keep
 *     strategies focused purely on business rules.
 */
export interface InterestStrategy {
  /**
   * Calculate the monthly interest for a given time deposit.
   *
   * @param deposit - The time deposit to calculate interest for.
   * @returns The interest amount (unrounded). Returns 0 when interest
   *          should not be applied (e.g., within the grace period).
   */
  calculateInterest(deposit: TimeDeposit): number;
}
