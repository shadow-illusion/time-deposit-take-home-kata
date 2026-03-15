import { TimeDeposit } from './TimeDeposit';
import { InterestStrategyRegistry } from './domain/strategies/InterestStrategyRegistry';

/**
 * Calculates and applies monthly interest to time deposits.
 *
 * Refactored from a monolithic if/else chain to the Strategy Pattern:
 *   - Each plan type's interest logic lives in its own InterestStrategy implementation.
 *   - The InterestStrategyRegistry maps plan type identifiers to strategy instances.
 *   - New plan types can be supported by registering a strategy — no changes here.
 *
 * CONTRACT PRESERVED:
 *   - `updateBalance(xs: TimeDeposit[])` signature is unchanged.
 *   - Behaviour is identical: iterates deposits, calculates interest via strategy,
 *     rounds to 2 decimal places using the original rounding formula, and mutates
 *     the balance in-place.
 *   - Unknown plan types produce 0 interest (same as original fall-through behaviour).
 *
 * Rounding:
 *   Rounding is intentionally kept in the calculator (not in strategies) because
 *   it is a cross-cutting presentation/persistence concern, not a business rule.
 *   The formula `Math.round((value + Number.EPSILON) * 100) / 100` is preserved
 *   exactly from the original implementation to avoid floating-point drift.
 */
export class TimeDepositCalculator {
  private readonly registry: InterestStrategyRegistry;

  /**
   * @param registry - Optional custom registry. Defaults to the standard
   *   registry with basic, student, and premium strategies pre-registered.
   *   Accepting the registry via constructor enables DI and testability
   *   (Dependency Inversion Principle).
   */
  constructor(registry?: InterestStrategyRegistry) {
    this.registry = registry ?? new InterestStrategyRegistry();
  }

  /**
   * Update the balance of each time deposit by adding monthly interest.
   *
   * Mutates the `balance` property of each deposit in the array in-place.
   * This matches the original method contract — no return value, side-effect
   * on the input array.
   *
   * @param xs - Array of time deposits to update.
   */
  public updateBalance(xs: TimeDeposit[]): void {
    for (const deposit of xs) {
      const strategy = this.registry.getStrategy(deposit.planType);

      // Unknown plan types → 0 interest (matches original fall-through)
      const rawInterest = strategy ? strategy.calculateInterest(deposit) : 0;

      // Preserve original rounding: round to 2 decimal places
      // TODO: As a future improvement we can replace the code below with precise decimal.js rounding
      const roundedInterest = Math.round((rawInterest + Number.EPSILON) * 100) / 100;

      deposit.balance += roundedInterest;
    }
  }
}
