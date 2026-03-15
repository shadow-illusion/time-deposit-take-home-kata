import { TimeDepositRepository } from '../ports/TimeDepositRepository';
import { WithdrawalRepository, Withdrawal } from '../ports/WithdrawalRepository';

/**
 * Response DTO for a single time deposit with its withdrawals.
 * Matches the API schema required by the README:
 *   { id, planType, balance, days, withdrawals[] }
 */
export interface TimeDepositWithWithdrawals {
  id: number;
  planType: string;
  balance: number;
  days: number;
  withdrawals: Withdrawal[];
}

/**
 * Use case: Retrieve all time deposits enriched with their withdrawal records.
 *
 * This is a pure APPLICATION layer orchestrator — it has no knowledge of
 * HTTP, Lambda, Express, DynamoDB, or any other infrastructure concern.
 * It depends only on the repository PORTS (interfaces).
 *
 * Hexagonal architecture role: APPLICATION SERVICE (inside the hexagon).
 */
export class GetTimeDepositsUseCase {
  constructor(
    private readonly timeDepositRepo: TimeDepositRepository,
    private readonly withdrawalRepo: WithdrawalRepository,
  ) {}

  /**
   * Execute the use case.
   * @returns All time deposits with their associated withdrawal records.
   */
  async execute(): Promise<TimeDepositWithWithdrawals[]> {
    // 1. Fetch all deposits
    const deposits = await this.timeDepositRepo.findAll();

    // 2. Fetch all withdrawals in one call (avoids N+1 queries)
    const withdrawalsByDeposit = await this.withdrawalRepo.findAllGroupedByDepositId();

    // 3. Assemble response DTOs
    return deposits.map((deposit) => ({
      id: deposit.id,
      planType: deposit.planType,
      balance: deposit.balance,
      days: deposit.days,
      withdrawals: withdrawalsByDeposit.get(deposit.id) ?? [],
    }));
  }
}
