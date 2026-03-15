/**
 * Withdrawal entity as stored in the persistence layer.
 *
 * This is a simple data structure — not a domain aggregate — because
 * withdrawals are read-only in the current requirements (displayed
 * alongside time deposits but not mutated by business logic).
 */
export interface Withdrawal {
  id: number;
  timeDepositId: number;
  amount: number;
  /** ISO 8601 date string, e.g. "2026-03-14" */
  date: string;
}

/**
 * Port: Repository interface for withdrawal persistence.
 *
 * Driven port — adapters provide the actual data access implementation.
 */
export interface WithdrawalRepository {
  /**
   * Retrieve all withdrawals for a specific time deposit.
   * @param timeDepositId - The deposit to query withdrawals for.
   */
  findByTimeDepositId(timeDepositId: number): Promise<Withdrawal[]>;

  /**
   * Retrieve all withdrawals, grouped by time deposit ID.
   * This is more efficient than N+1 queries when loading all deposits.
   * @returns A map of timeDepositId → Withdrawal[]
   */
  findAllGroupedByDepositId(): Promise<Map<number, Withdrawal[]>>;
}
