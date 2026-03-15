import { TimeDepositRepository } from '../ports/TimeDepositRepository';
import { TimeDepositCalculator } from '../domain';

/**
 * Result DTO for the update-balances operation.
 */
export interface UpdateBalancesResult {
  /** Number of deposits whose balance was updated */
  updatedCount: number;
}

/**
 * Use case: Recalculate and persist updated balances for all time deposits.
 *
 * Orchestration:
 *   1. Load all time deposits from the repository.
 *   2. Run the existing TimeDepositCalculator.updateBalance() which mutates
 *      balances in-place (preserving the original contract).
 *   3. Persist the updated deposits back to the repository.
 *
 * Hexagonal architecture role: APPLICATION SERVICE (inside the hexagon).
 * No knowledge of HTTP, Lambda, Express, or any specific database.
 */
export class UpdateBalancesUseCase {
  constructor(
    private readonly timeDepositRepo: TimeDepositRepository,
    private readonly calculator: TimeDepositCalculator,
  ) {}

  /**
   * Execute the use case.
   * @returns Count of deposits that were updated.
   */
  async execute(): Promise<UpdateBalancesResult> {
    // 1. Load all deposits
    const deposits = await this.timeDepositRepo.findAll();

    if (deposits.length === 0) {
      return { updatedCount: 0 };
    }

    // 2. Calculate interest (mutates balance in-place)
    this.calculator.updateBalance(deposits);

    // 3. Persist updated balances
    await this.timeDepositRepo.saveAll(deposits);

    return { updatedCount: deposits.length };
  }
}
