import { TimeDeposit } from '../../domain';
import { TimeDepositRepository } from '../../ports/TimeDepositRepository';

/**
 * Driven adapter: In-memory implementation of TimeDepositRepository.
 *
 * Used for:
 *   - Local development (Express server)
 *   - Unit / integration tests
 *
 * Stores deposits in a Map keyed by id. Supports optional initial seed data.
 */
export class InMemoryTimeDepositRepository implements TimeDepositRepository {
  private readonly store = new Map<number, TimeDeposit>();

  constructor(initialData?: TimeDeposit[]) {
    if (initialData) {
      for (const deposit of initialData) {
        this.store.set(deposit.id, deposit);
      }
    }
  }

  async findAll(): Promise<TimeDeposit[]> {
    // Return copies to prevent external mutation of the store
    return Array.from(this.store.values()).map(
      (d) => new TimeDeposit(d.id, d.planType, d.balance, d.days),
    );
  }

  async save(deposit: TimeDeposit): Promise<void> {
    this.store.set(deposit.id, new TimeDeposit(deposit.id, deposit.planType, deposit.balance, deposit.days));
  }

  async saveAll(deposits: TimeDeposit[]): Promise<void> {
    for (const deposit of deposits) {
      await this.save(deposit);
    }
  }

  /** Test helper: get current store size */
  get size(): number {
    return this.store.size;
  }

  /** Test helper: clear all data */
  clear(): void {
    this.store.clear();
  }

  /** Test helper: get a deposit by id */
  getById(id: number): TimeDeposit | undefined {
    const d = this.store.get(id);
    if (!d) return undefined;
    return new TimeDeposit(d.id, d.planType, d.balance, d.days);
  }
}
