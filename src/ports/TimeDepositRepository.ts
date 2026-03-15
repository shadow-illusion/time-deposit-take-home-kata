import { TimeDeposit } from '../TimeDeposit';

/**
 * Port: Repository interface for time deposit persistence.
 *
 * This is the DRIVEN PORT in hexagonal architecture — it defines what
 * the application layer needs from the persistence layer, WITHOUT
 * specifying HOW it's implemented (DynamoDB, PostgreSQL, in-memory, etc.).
 *
 * Adapters implement this interface:
 *   - DynamoDBTimeDepositRepository  (production — AWS Lambda)
 *   - InMemoryTimeDepositRepository  (local dev / testing)
 */
export interface TimeDepositRepository {
  /**
   * Retrieve all time deposits.
   * @returns All deposits stored in the data source.
   */
  findAll(): Promise<TimeDeposit[]>;

  /**
   * Persist a single time deposit (create or full replace).
   * @param deposit - The time deposit to save.
   */
  save(deposit: TimeDeposit): Promise<void>;

  /**
   * Persist multiple time deposits in a batch.
   * Implementations should handle batching limits (e.g. DynamoDB 25-item batch).
   * @param deposits - The deposits to save.
   */
  saveAll(deposits: TimeDeposit[]): Promise<void>;
}
