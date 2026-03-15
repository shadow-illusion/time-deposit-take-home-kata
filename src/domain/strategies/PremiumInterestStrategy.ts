import { TimeDeposit } from '../../TimeDeposit';
import { InterestStrategy } from './InterestStrategy';
import {
  MONTHS_IN_YEAR,
  PREMIUM_ANNUAL_RATE,
  PREMIUM_MIN_DAYS,
} from './InterestConstants';

/**
 * Premium Plan interest strategy.
 *
 * Rules:
 *   - 5% annual interest, applied monthly.
 *   - Interest starts after 45 days (days > 45).
 *   - No upper bound — premium plan earns interest indefinitely after day 45.
 *
 * Note: The 45-day threshold is stricter than the universal 30-day rule,
 * so checking `days > 45` implicitly satisfies the universal constraint.
 * We keep the check explicit for clarity and to match the original code.
 *
 * Formula (when applicable): (balance × 0.05) / 12
 */
export class PremiumInterestStrategy implements InterestStrategy {
  calculateInterest(deposit: TimeDeposit): number {
    if (deposit.days <= PREMIUM_MIN_DAYS) {
      return 0;
    }

    return (deposit.balance * PREMIUM_ANNUAL_RATE) / MONTHS_IN_YEAR;
  }
}
