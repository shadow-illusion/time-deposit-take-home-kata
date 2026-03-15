import { TimeDeposit } from '../TimeDeposit';
import { BasicInterestStrategy } from '../domain/strategies/BasicInterestStrategy';

describe('BasicInterestStrategy', () => {
  const strategy = new BasicInterestStrategy();

  // ─── No Interest Period (days <= 30) ────────────────────────────────
  describe('no interest period (days <= 30)', () => {
    test.each([0, 1, 15, 29, 30])(
      'returns 0 interest when days = %i',
      (days) => {
        const deposit = new TimeDeposit(1, 'basic', 100_000, days);
        expect(strategy.calculateInterest(deposit)).toBe(0);
      },
    );
  });

  // ─── Interest Earning Period (days > 30) ────────────────────────────
  describe('interest earning period (days > 30)', () => {
    test('calculates 1% annual interest monthly for day 31', () => {
      const deposit = new TimeDeposit(1, 'basic', 120_000, 31);
      // (120,000 × 0.01) / 12 = 100
      expect(strategy.calculateInterest(deposit)).toBe(100);
    });

    test('calculates correctly for large balance', () => {
      const deposit = new TimeDeposit(1, 'basic', 1_234_567, 45);
      // (1,234,567 × 0.01) / 12 = 1028.8058333...
      expect(strategy.calculateInterest(deposit)).toBeCloseTo(1028.8058333, 4);
    });

    test('calculates correctly for day 365', () => {
      const deposit = new TimeDeposit(1, 'basic', 50_000, 365);
      // (50,000 × 0.01) / 12 = 41.6666...
      expect(strategy.calculateInterest(deposit)).toBeCloseTo(41.6667, 4);
    });

    test('still earns interest well beyond 1 year (no cap)', () => {
      const deposit = new TimeDeposit(1, 'basic', 50_000, 1000);
      expect(strategy.calculateInterest(deposit)).toBeGreaterThan(0);
    });
  });

  // ─── Zero Balance ──────────────────────────────────────────────────
  test('returns 0 interest when balance is 0', () => {
    const deposit = new TimeDeposit(1, 'basic', 0, 45);
    expect(strategy.calculateInterest(deposit)).toBe(0);
  });
});
