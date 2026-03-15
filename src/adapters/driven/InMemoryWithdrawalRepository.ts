import { Withdrawal, WithdrawalRepository } from '../../ports/WithdrawalRepository';

/**
 * Driven adapter: In-memory implementation of WithdrawalRepository.
 *
 * Used for:
 *   - Local development (Express server)
 *   - Unit / integration tests
 *
 * Stores withdrawals in an array. Supports optional initial seed data.
 */
export class InMemoryWithdrawalRepository implements WithdrawalRepository {
  private readonly store: Withdrawal[] = [];

  constructor(initialData?: Withdrawal[]) {
    if (initialData) {
      this.store.push(...initialData);
    }
  }

  async findByTimeDepositId(timeDepositId: number): Promise<Withdrawal[]> {
    return this.store
      .filter((w) => w.timeDepositId === timeDepositId)
      .map((w) => ({ ...w })); // return copies
  }

  async findAllGroupedByDepositId(): Promise<Map<number, Withdrawal[]>> {
    const grouped = new Map<number, Withdrawal[]>();

    for (const w of this.store) {
      const existing = grouped.get(w.timeDepositId) ?? [];
      existing.push({ ...w });
      grouped.set(w.timeDepositId, existing);
    }

    return grouped;
  }

  /** Test helper: add a withdrawal */
  add(withdrawal: Withdrawal): void {
    this.store.push({ ...withdrawal });
  }

  /** Test helper: get current store size */
  get size(): number {
    return this.store.length;
  }

  /** Test helper: clear all data */
  clear(): void {
    this.store.length = 0;
  }
}
