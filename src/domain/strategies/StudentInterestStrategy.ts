import { TimeDeposit } from '../../TimeDeposit';
import { InterestStrategy } from './InterestStrategy';
import {
  MIN_DAYS_FOR_INTEREST,
  MONTHS_IN_YEAR,
  STUDENT_ANNUAL_RATE,
  STUDENT_MAX_DAYS,
} from './InterestConstants';

/**
 * Student Plan interest strategy.
 *
 * Rules:
 *   - 3% annual interest, applied monthly.
 *   - No interest for the first 30 days (universal rule).
 *   - No interest after 1 year (days >= 366).
 *
 * Assumption: The original code checks `days < 366`, meaning interest is
 * paid on days 31–365 inclusive. Day 366+ earns nothing. We preserve this
 * exact behaviour.
 *
 * Formula (when applicable): (balance × 0.03) / 12
 */
export class StudentInterestStrategy implements InterestStrategy {
  calculateInterest(deposit: TimeDeposit): number {
    if (deposit.days <= MIN_DAYS_FOR_INTEREST) {
      return 0;
    }

    if (deposit.days >= STUDENT_MAX_DAYS) {
      return 0;
    }

    return (deposit.balance * STUDENT_ANNUAL_RATE) / MONTHS_IN_YEAR;
  }
}
