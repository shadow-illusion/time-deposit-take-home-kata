import { TimeDeposit } from '../TimeDeposit';
import { PremiumInterestStrategy } from '../domain/strategies/PremiumInterestStrategy';

describe('PremiumInterestStrategy', () => {
  const strategy = new PremiumInterestStrategy();

  // ─── No Interest Period (days <= 45 for premium) ───────────────────
  describe('no interest period (days <= 45)', () => {
    test.each([0, 1, 15, 29, 30, 31, 44, 45])(
      'returns 0 interest when days = %i',
      (days) => {
        const deposit = new TimeDeposit(1, 'premium', 100_000, days);
        expect(strategy.calculateInterest(deposit)).toBe(0);
      },
    );
  });

  // ─── Interest Earning Period (days > 45) ───────────────────────────
  describe('interest earning period (days > 45)', () => {
    test('calculates 5% annual interest monthly for day 46', () => {
      const deposit = new TimeDeposit(1, 'premium', 120_000, 46);
      // (120,000 × 0.05) / 12 = 500
      expect(strategy.calculateInterest(deposit)).toBe(500);
    });

    test('calculates correctly for large balance', () => {
      const deposit = new TimeDeposit(1, 'premium', 1_234_567, 100);
      // (1,234,567 × 0.05) / 12 = 5144.029166...
      expect(strategy.calculateInterest(deposit)).toBeCloseTo(5144.0292, 4);
    });

    test('still earns interest well beyond 1 year (no cap)', () => {
      const deposit = new TimeDeposit(1, 'premium', 50_000, 1000);
      expect(strategy.calculateInterest(deposit)).toBeGreaterThan(0);
    });
  });

  // ─── Zero Balance ──────────────────────────────────────────────────
  test('returns 0 interest when balance is 0', () => {
    const deposit = new TimeDeposit(1, 'premium', 0, 100);
    expect(strategy.calculateInterest(deposit)).toBe(0);
  });
});
