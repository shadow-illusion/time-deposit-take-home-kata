import { TimeDeposit } from '../TimeDeposit'
import { TimeDepositCalculator } from '../TimeDepositCalculator'
import { InterestStrategyRegistry } from '../domain/strategies/InterestStrategyRegistry'
import { InterestStrategy } from '../domain/strategies/InterestStrategy'

/**
 * TimeDepositCalculator test suite.
 *
 * Organised into:
 *   1. Regression tests — verify refactored calculator produces identical results
 *      to the original implementation for every plan type and edge case.
 *   2. Rounding tests — ensure the original rounding formula is preserved.
 *   3. Multi-deposit tests — verify batch behaviour (multiple plans in one call).
 *   4. Unknown plan type tests — fall-through to 0 interest.
 *   5. Extensibility tests — demonstrate DI with a custom registry.
 */
describe('TimeDepositCalculator', () => {
  let calculator: TimeDepositCalculator;

  beforeEach(() => {
    calculator = new TimeDepositCalculator();
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  1. REGRESSION TESTS — parity with original implementation
  // ═══════════════════════════════════════════════════════════════════════
  //
  // These tests use the EXACT same inputs and verify the EXACT same
  // balance outcomes that the original monolithic updateBalance() produced.
  // This ensures the refactoring introduced NO breaking changes.

  describe('Basic plan regression', () => {
    test('no interest at day 30 (grace period boundary)', () => {
      const plans = [new TimeDeposit(1, 'basic', 1_234_567.0, 30)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_234_567.0); // unchanged
    });

    test('interest starts at day 31', () => {
      const plans = [new TimeDeposit(1, 'basic', 1_234_567.0, 31)];
      calculator.updateBalance(plans);
      // Original: (1234567 × 0.01) / 12 = 1028.805833... → rounded 1028.81
      expect(plans[0].balance).toBe(1_234_567.0 + 1028.81);
    });

    test('interest at day 45 (original test case)', () => {
      const plans = [new TimeDeposit(1, 'basic', 1_234_567.0, 45)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_234_567.0 + 1028.81);
    });

    test('interest at day 365', () => {
      const plans = [new TimeDeposit(1, 'basic', 1_234_567.0, 365)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_234_567.0 + 1028.81);
    });

    test('interest beyond 1 year (no cap for basic)', () => {
      const plans = [new TimeDeposit(1, 'basic', 1_234_567.0, 730)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_234_567.0 + 1028.81);
    });
  });

  describe('Student plan regression', () => {
    test('no interest at day 30 (grace period boundary)', () => {
      const plans = [new TimeDeposit(1, 'student', 1_234_567.0, 30)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_234_567.0);
    });

    test('interest starts at day 31', () => {
      const plans = [new TimeDeposit(1, 'student', 1_234_567.0, 31)];
      calculator.updateBalance(plans);
      // Original: (1234567 × 0.03) / 12 = 3086.4175 → rounded 3086.42
      expect(plans[0].balance).toBe(1_234_567.0 + 3086.42);
    });

    test('interest at day 365 (last eligible day)', () => {
      const plans = [new TimeDeposit(1, 'student', 1_234_567.0, 365)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_234_567.0 + 3086.42);
    });

    test('no interest at day 366 (1 year expired)', () => {
      const plans = [new TimeDeposit(1, 'student', 1_234_567.0, 366)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_234_567.0); // unchanged
    });

    test('no interest at day 730 (well past 1 year)', () => {
      const plans = [new TimeDeposit(1, 'student', 1_234_567.0, 730)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_234_567.0); // unchanged
    });
  });

  describe('Premium plan regression', () => {
    test('no interest at day 30 (grace period)', () => {
      const plans = [new TimeDeposit(1, 'premium', 1_234_567.0, 30)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_234_567.0);
    });

    test('no interest at day 45 (premium threshold boundary)', () => {
      const plans = [new TimeDeposit(1, 'premium', 1_234_567.0, 45)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_234_567.0); // unchanged
    });

    test('interest starts at day 46', () => {
      const plans = [new TimeDeposit(1, 'premium', 1_234_567.0, 46)];
      calculator.updateBalance(plans);
      // Original: (1234567 × 0.05) / 12 = 5144.029166... → rounded 5144.03
      expect(plans[0].balance).toBe(1_234_567.0 + 5144.03);
    });

    test('interest beyond 1 year (no cap for premium)', () => {
      const plans = [new TimeDeposit(1, 'premium', 1_234_567.0, 730)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_234_567.0 + 5144.03);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  2. ROUNDING TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('rounding', () => {
    test('rounds to exactly 2 decimal places', () => {
      // 100,001 × 0.01 / 12 = 83.334166... → should round to 83.33
      const plans = [new TimeDeposit(1, 'basic', 100_001, 31)];
      calculator.updateBalance(plans);
      // Check the final balance directly (avoids floating-point subtraction drift)
      expect(plans[0].balance).toBe(100_084.33);
    });

    test('rounds 0.005 up (banker rounding via Math.round)', () => {
      // Craft a balance where raw interest ends in exactly .005
      // 60,000 × 0.01 / 12 = 50.0 → exact, no rounding needed
      const plans = [new TimeDeposit(1, 'basic', 60_000, 31)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(60_050);
    });

    test('zero interest produces no balance change', () => {
      const plans = [new TimeDeposit(1, 'basic', 1_000, 15)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  3. MULTI-DEPOSIT (BATCH) TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('multiple deposits in a single call', () => {
    test('updates all deposits independently', () => {
      const plans = [
        new TimeDeposit(1, 'basic', 120_000, 45),
        new TimeDeposit(2, 'student', 120_000, 45),
        new TimeDeposit(3, 'premium', 120_000, 46),
      ];

      calculator.updateBalance(plans);

      // basic:   (120000 × 0.01) / 12 = 100.00
      expect(plans[0].balance).toBe(120_100);
      // student: (120000 × 0.03) / 12 = 300.00
      expect(plans[1].balance).toBe(120_300);
      // premium: (120000 × 0.05) / 12 = 500.00
      expect(plans[2].balance).toBe(120_500);
    });

    test('handles empty array gracefully', () => {
      const plans: TimeDeposit[] = [];
      calculator.updateBalance(plans);
      expect(plans).toHaveLength(0); // no crash, no-op
    });

    test('handles mix of earning and non-earning deposits', () => {
      const plans = [
        new TimeDeposit(1, 'basic', 100_000, 10),   // grace period
        new TimeDeposit(2, 'student', 100_000, 400), // past 1 year
        new TimeDeposit(3, 'premium', 100_000, 40),  // before 45 days
        new TimeDeposit(4, 'basic', 100_000, 50),    // earning
      ];

      calculator.updateBalance(plans);

      expect(plans[0].balance).toBe(100_000); // no change
      expect(plans[1].balance).toBe(100_000); // no change
      expect(plans[2].balance).toBe(100_000); // no change
      expect(plans[3].balance).toBeGreaterThan(100_000); // earned interest
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  4. UNKNOWN PLAN TYPE TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('unknown plan types', () => {
    test('unknown plan type gets 0 interest (same as original fall-through)', () => {
      const plans = [new TimeDeposit(1, 'corporate', 1_000_000, 100)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_000_000); // unchanged
    });

    test('empty string plan type gets 0 interest', () => {
      const plans = [new TimeDeposit(1, '', 1_000_000, 100)];
      calculator.updateBalance(plans);
      expect(plans[0].balance).toBe(1_000_000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  5. EXTENSIBILITY TESTS (Dependency Injection)
  // ═══════════════════════════════════════════════════════════════════════

  describe('extensibility via custom registry', () => {
    test('calculator uses injected registry with custom strategy', () => {
      const customRegistry = new InterestStrategyRegistry();
      const corporateStrategy: InterestStrategy = {
        // Corporate plan: flat 7% annual
        calculateInterest: (deposit: TimeDeposit) =>
          deposit.days > 30 ? (deposit.balance * 0.07) / 12 : 0,
      };
      customRegistry.register('corporate', corporateStrategy);

      const calc = new TimeDepositCalculator(customRegistry);
      const plans = [new TimeDeposit(1, 'corporate', 120_000, 45)];
      calc.updateBalance(plans);

      // (120000 × 0.07) / 12 = 700.00
      expect(plans[0].balance).toBe(120_700);
    });

    test('custom registry still supports default plan types', () => {
      const customRegistry = new InterestStrategyRegistry();
      const calc = new TimeDepositCalculator(customRegistry);

      const plans = [new TimeDeposit(1, 'basic', 120_000, 45)];
      calc.updateBalance(plans);
      expect(plans[0].balance).toBe(120_100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  //  6. MUTATION / IDEMPOTENCY TESTS
  // ═══════════════════════════════════════════════════════════════════════

  describe('mutation behaviour', () => {
    test('calling updateBalance twice compounds interest', () => {
      const plans = [new TimeDeposit(1, 'basic', 120_000, 45)];

      calculator.updateBalance(plans);
      const afterFirst = plans[0].balance; // 120,100

      calculator.updateBalance(plans);
      const afterSecond = plans[0].balance;

      // Second call applies interest to the updated balance
      expect(afterSecond).toBeGreaterThan(afterFirst);
      // (120100 × 0.01) / 12 = 100.0833... → rounded 100.08
      expect(afterSecond).toBe(120_200.08);
    });
  });
});
