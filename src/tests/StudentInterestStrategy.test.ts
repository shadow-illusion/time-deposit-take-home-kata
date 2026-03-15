import { TimeDeposit } from '../TimeDeposit';
import { StudentInterestStrategy } from '../domain/strategies/StudentInterestStrategy';

describe('StudentInterestStrategy', () => {
  const strategy = new StudentInterestStrategy();

  // ─── No Interest Period (days <= 30) ────────────────────────────────
  describe('no interest period (days <= 30)', () => {
    test.each([0, 1, 15, 29, 30])(
      'returns 0 interest when days = %i',
      (days) => {
        const deposit = new TimeDeposit(1, 'student', 100_000, days);
        expect(strategy.calculateInterest(deposit)).toBe(0);
      },
    );
  });

  // ─── Interest Earning Period (31 <= days <= 365) ────────────────────
  describe('interest earning period (31 <= days <= 365)', () => {
    test('calculates 3% annual interest monthly for day 31', () => {
      const deposit = new TimeDeposit(1, 'student', 120_000, 31);
      // (120,000 × 0.03) / 12 = 300
      expect(strategy.calculateInterest(deposit)).toBe(300);
    });

    test('calculates correctly for day 365 (last earning day)', () => {
      const deposit = new TimeDeposit(1, 'student', 120_000, 365);
      // (120,000 × 0.03) / 12 = 300
      expect(strategy.calculateInterest(deposit)).toBe(300);
    });

    test('calculates correctly for large balance', () => {
      const deposit = new TimeDeposit(1, 'student', 1_234_567, 100);
      // (1,234,567 × 0.03) / 12 = 3086.4175
      expect(strategy.calculateInterest(deposit)).toBeCloseTo(3086.4175, 4);
    });
  });

  // ─── Post-1-Year Period (days >= 366) ──────────────────────────────
  describe('post-1-year period (days >= 366)', () => {
    test.each([366, 367, 400, 730, 1000])(
      'returns 0 interest when days = %i (past 1 year)',
      (days) => {
        const deposit = new TimeDeposit(1, 'student', 100_000, days);
        expect(strategy.calculateInterest(deposit)).toBe(0);
      },
    );
  });

  // ─── Zero Balance ──────────────────────────────────────────────────
  test('returns 0 interest when balance is 0', () => {
    const deposit = new TimeDeposit(1, 'student', 0, 100);
    expect(strategy.calculateInterest(deposit)).toBe(0);
  });
});
