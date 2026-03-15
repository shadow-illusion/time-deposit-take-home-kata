import { DynamoDBDocumentClient, ScanCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Withdrawal, WithdrawalRepository } from '../../ports/WithdrawalRepository';

/**
 * Driven adapter: DynamoDB implementation of WithdrawalRepository.
 *
 * Uses:
 *   - Scan for findAllGroupedByDepositId (loads everything in one pass)
 *   - Query on the GSI for findByTimeDepositId (efficient single-deposit lookup)
 *
 * DynamoDB item schema:
 *   { id: N, timeDepositId: N, amount: N, date: S }
 *
 * GSI: timeDepositId-index (partition key: timeDepositId, projection: ALL)
 */
export class DynamoDBWithdrawalRepository implements WithdrawalRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string,
    private readonly gsiName: string = 'timeDepositId-index',
  ) {}

  async findByTimeDepositId(timeDepositId: number): Promise<Withdrawal[]> {
    const withdrawals: Withdrawal[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: this.gsiName,
          KeyConditionExpression: 'timeDepositId = :depositId',
          ExpressionAttributeValues: {
            ':depositId': timeDepositId,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      if (result.Items) {
        for (const item of result.Items) {
          withdrawals.push({
            id: item.id as number,
            timeDepositId: item.timeDepositId as number,
            amount: item.amount as number,
            date: item.date as string,
          });
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);

    return withdrawals;
  }

  async findAllGroupedByDepositId(): Promise<Map<number, Withdrawal[]>> {
    const grouped = new Map<number, Withdrawal[]>();
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const result = await this.docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      if (result.Items) {
        for (const item of result.Items) {
          const withdrawal: Withdrawal = {
            id: item.id as number,
            timeDepositId: item.timeDepositId as number,
            amount: item.amount as number,
            date: item.date as string,
          };

          const existing = grouped.get(withdrawal.timeDepositId) ?? [];
          existing.push(withdrawal);
          grouped.set(withdrawal.timeDepositId, existing);
        }
      }

      lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);

    return grouped;
  }
}
