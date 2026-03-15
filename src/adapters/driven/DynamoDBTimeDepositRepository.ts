import { DynamoDBDocumentClient, ScanCommand, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { TimeDeposit } from '../../domain';
import { TimeDepositRepository } from '../../ports/TimeDepositRepository';

/**
 * Driven adapter: DynamoDB implementation of TimeDepositRepository.
 *
 * This adapter translates repository port operations into DynamoDB API calls.
 * It receives a pre-configured DynamoDBDocumentClient via constructor injection,
 * keeping it agnostic about client creation/configuration.
 *
 * DynamoDB item schema:
 *   { id: N, planType: S, balance: N, days: N }
 */
export class DynamoDBTimeDepositRepository implements TimeDepositRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async findAll(): Promise<TimeDeposit[]> {
    const deposits: TimeDeposit[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    // Handle pagination — DynamoDB Scan may return partial results
    do {
      const result = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      if (result.Items) {
        for (const item of result.Items) {
          deposits.push(
            new TimeDeposit(
              item.id as number,
              item.planType as string,
              item.balance as number,
              item.days as number,
            ),
          );
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);

    return deposits;
  }

  async save(deposit: TimeDeposit): Promise<void> {
    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          id: deposit.id,
          planType: deposit.planType,
          balance: deposit.balance,
          days: deposit.days,
        },
      }),
    );
  }

  async saveAll(deposits: TimeDeposit[]): Promise<void> {
    // DynamoDB BatchWriteItem supports max 25 items per request
    const BATCH_SIZE = 25;

    for (let i = 0; i < deposits.length; i += BATCH_SIZE) {
      const batch = deposits.slice(i, i + BATCH_SIZE);

      const putRequests = batch.map((deposit) => ({
        PutRequest: {
          Item: {
            id: deposit.id,
            planType: deposit.planType,
            balance: deposit.balance,
            days: deposit.days,
          },
        },
      }));

      let unprocessedItems: typeof putRequests | undefined = putRequests;

      // Retry unprocessed items with exponential backoff
      let retryCount = 0;
      const MAX_RETRIES = 3;

      while (unprocessedItems && unprocessedItems.length > 0 && retryCount <= MAX_RETRIES) {
        const result = await this.docClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [this.tableName]: unprocessedItems,
            },
          }),
        );

        const unprocessed = result.UnprocessedItems?.[this.tableName];
        if (unprocessed && unprocessed.length > 0) {
          unprocessedItems = unprocessed as typeof putRequests;
          retryCount++;
          // Exponential backoff: 100ms, 200ms, 400ms
          await new Promise((resolve) => setTimeout(resolve, 100 * Math.pow(2, retryCount)));
        } else {
          unprocessedItems = undefined;
        }
      }
    }
  }
}
