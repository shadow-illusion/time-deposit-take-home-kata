import { InterestStrategyRegistry } from '../domain/strategies/InterestStrategyRegistry';
import { BasicInterestStrategy } from '../domain/strategies/BasicInterestStrategy';
import { StudentInterestStrategy } from '../domain/strategies/StudentInterestStrategy';
import { PremiumInterestStrategy } from '../domain/strategies/PremiumInterestStrategy';
import { InterestStrategy } from '../domain/strategies/InterestStrategy';
import { TimeDeposit } from '../TimeDeposit';

describe('InterestStrategyRegistry', () => {
  let registry: InterestStrategyRegistry;

  beforeEach(() => {
    registry = new InterestStrategyRegistry();
  });

  // ─── Default Registrations ─────────────────────────────────────────
  describe('default registrations', () => {
    test('has basic strategy registered', () => {
      expect(registry.hasStrategy('basic')).toBe(true);
      expect(registry.getStrategy('basic')).toBeInstanceOf(BasicInterestStrategy);
    });

    test('has student strategy registered', () => {
      expect(registry.hasStrategy('student')).toBe(true);
      expect(registry.getStrategy('student')).toBeInstanceOf(StudentInterestStrategy);
    });

    test('has premium strategy registered', () => {
      expect(registry.hasStrategy('premium')).toBe(true);
      expect(registry.getStrategy('premium')).toBeInstanceOf(PremiumInterestStrategy);
    });

    test('returns all 3 default plan types', () => {
      const planTypes = registry.getRegisteredPlanTypes();
      expect(planTypes).toHaveLength(3);
      expect(planTypes).toContain('basic');
      expect(planTypes).toContain('student');
      expect(planTypes).toContain('premium');
    });
  });

  // ─── Unknown Plan Types ────────────────────────────────────────────
  describe('unknown plan types', () => {
    test('returns undefined for unregistered plan type', () => {
      expect(registry.getStrategy('corporate')).toBeUndefined();
    });

    test('hasStrategy returns false for unregistered plan type', () => {
      expect(registry.hasStrategy('corporate')).toBe(false);
    });

    test('is case-sensitive', () => {
      expect(registry.getStrategy('Basic')).toBeUndefined();
      expect(registry.getStrategy('BASIC')).toBeUndefined();
    });
  });

  // ─── Custom Registration ──────────────────────────────────────────
  describe('custom registration (extensibility)', () => {
    test('can register a new plan type', () => {
      const mockStrategy: InterestStrategy = {
        calculateInterest: () => 42,
      };

      registry.register('corporate', mockStrategy);

      expect(registry.hasStrategy('corporate')).toBe(true);
      expect(registry.getStrategy('corporate')).toBe(mockStrategy);
      expect(registry.getRegisteredPlanTypes()).toContain('corporate');
    });

    test('can override an existing plan type', () => {
      const customBasic: InterestStrategy = {
        calculateInterest: () => 999,
      };

      registry.register('basic', customBasic);

      const deposit = new TimeDeposit(1, 'basic', 100_000, 45);
      expect(registry.getStrategy('basic')!.calculateInterest(deposit)).toBe(999);
    });

    test('registering new types does not affect existing ones', () => {
      const mockStrategy: InterestStrategy = {
        calculateInterest: () => 0,
      };

      registry.register('corporate', mockStrategy);

      expect(registry.getStrategy('basic')).toBeInstanceOf(BasicInterestStrategy);
      expect(registry.getStrategy('student')).toBeInstanceOf(StudentInterestStrategy);
      expect(registry.getStrategy('premium')).toBeInstanceOf(PremiumInterestStrategy);
    });
  });
});
