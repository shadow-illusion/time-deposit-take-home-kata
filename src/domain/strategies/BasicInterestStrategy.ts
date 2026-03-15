import { TimeDeposit } from '../../TimeDeposit';
import { InterestStrategy } from './InterestStrategy';
import {
  BASIC_ANNUAL_RATE,
  MIN_DAYS_FOR_INTEREST,
  MONTHS_IN_YEAR,
} from './InterestConstants';

/**
 * Basic Plan interest strategy.
 *
 * Rules:
 *   - 1% annual interest, applied monthly.
 *   - No interest for the first 30 days (universal rule).
 *   - No upper bound on days — basic plan earns interest indefinitely.
 *
 * Formula: (balance × 0.01) / 12
 */
export class BasicInterestStrategy implements InterestStrategy {
  calculateInterest(deposit: TimeDeposit): number {
    if (deposit.days <= MIN_DAYS_FOR_INTEREST) {
      return 0;
    }

    return (deposit.balance * BASIC_ANNUAL_RATE) / MONTHS_IN_YEAR;
  }
}
