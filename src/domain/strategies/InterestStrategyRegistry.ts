import { InterestStrategy } from './InterestStrategy';
import { BasicInterestStrategy } from './BasicInterestStrategy';
import { StudentInterestStrategy } from './StudentInterestStrategy';
import { PremiumInterestStrategy } from './PremiumInterestStrategy';

/**
 * Registry that maps plan type identifiers to their interest calculation strategy.
 *
 * This follows the Registry / Factory pattern and supports the OCP:
 *   - New plan types are added by calling `register()` — no switch/if-else to modify.
 *   - The calculator depends on this registry rather than concrete strategy classes.
 *
 * Default registrations (matching the original business rules):
 *   - 'basic'   → BasicInterestStrategy   (1%)
 *   - 'student' → StudentInterestStrategy  (3%, max 1 year)
 *   - 'premium' → PremiumInterestStrategy  (5%, after 45 days)
 *
 * Extensibility example:
 *   registry.register('corporate', new CorporateInterestStrategy());
 */
export class InterestStrategyRegistry {
  private readonly strategies = new Map<string, InterestStrategy>();

  constructor() {
    // Register the three plan types defined in the requirements
    this.register('basic', new BasicInterestStrategy());
    this.register('student', new StudentInterestStrategy());
    this.register('premium', new PremiumInterestStrategy());
  }

  /**
   * Register (or override) an interest strategy for a plan type.
   *
   * @param planType - Case-sensitive plan type identifier (e.g. 'basic').
   * @param strategy - The strategy instance to use for this plan type.
   */
  register(planType: string, strategy: InterestStrategy): void {
    this.strategies.set(planType, strategy);
  }

  /**
   * Retrieve the interest strategy for a given plan type.
   *
   * @param planType - The plan type to look up.
   * @returns The strategy, or `undefined` if the plan type is not registered.
   *
   * Assumption: Unknown plan types return undefined rather than throwing,
   * because the original code simply does not add interest for unrecognised
   * plans (the else-if chain falls through with a = 0). The calculator
   * preserves this behaviour by treating undefined as "no interest".
   */
  getStrategy(planType: string): InterestStrategy | undefined {
    return this.strategies.get(planType);
  }

  /**
   * Check whether a strategy is registered for a plan type.
   */
  hasStrategy(planType: string): boolean {
    return this.strategies.has(planType);
  }

  /**
   * Get all registered plan types.
   */
  getRegisteredPlanTypes(): string[] {
    return Array.from(this.strategies.keys());
  }
}
