/**
 * Domain barrel export.
 *
 * Re-exports the core domain entities and services so that the application
 * and adapter layers can import from a single canonical location:
 *   import { TimeDeposit, TimeDepositCalculator } from '../domain';
 *
 * Note: TimeDeposit.ts and TimeDepositCalculator.ts remain in their original
 * locations (src/) to honour the "no breaking changes" constraint. This barrel
 * simply provides a convenient hexagonal-friendly import path.
 */
export { TimeDeposit } from '../TimeDeposit';
export { TimeDepositCalculator } from '../TimeDepositCalculator';
export { InterestStrategyRegistry } from './strategies/InterestStrategyRegistry';
export type { InterestStrategy } from './strategies/InterestStrategy';
