import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * DatabaseStack provisions the DynamoDB tables required by the Time Deposit system.
 *
 * Tables:
 *  - timeDeposits: Stores time deposit plans with id, planType, days, balance.
 *  - withdrawals: Stores withdrawal records with a GSI on timeDepositId for efficient lookups.
 *
 * Best practices applied:
 *  - PAY_PER_REQUEST billing (on-demand) for cost optimisation at low/unpredictable traffic.
 *  - Point-in-time recovery enabled for data protection.
 *  - Server-side encryption with AWS managed keys.
 *  - Deletion protection enabled (RETAIN removal policy) to prevent accidental data loss.
 */
export class DatabaseStack extends cdk.Stack {
  public readonly timeDepositsTable: dynamodb.Table;
  public readonly withdrawalsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── Time Deposits Table ────────────────────────────────────────────
    // Schema based on src/TimeDeposit.ts:
    //   id:       number  (partition key)
    //   planType: string  (basic | student | premium)
    //   days:     number
    //   balance:  number
    this.timeDepositsTable = new dynamodb.Table(this, 'TimeDepositsTable', {
      tableName: 'timeDeposits',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deletionProtection: true,
    });

    // ─── Withdrawals Table ──────────────────────────────────────────────
    // Schema:
    //   id:              number  (partition key)
    //   timeDepositId:   number  (GSI partition key – enables querying withdrawals per deposit)
    //   amount:          number
    //   date:            string  (ISO 8601)
    this.withdrawalsTable = new dynamodb.Table(this, 'WithdrawalsTable', {
      tableName: 'withdrawals',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      deletionProtection: true,
    });

    // GSI: Query withdrawals by timeDepositId efficiently
    this.withdrawalsTable.addGlobalSecondaryIndex({
      indexName: 'timeDepositId-index',
      partitionKey: {
        name: 'timeDepositId',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ─── CloudFormation Outputs ─────────────────────────────────────────
    new cdk.CfnOutput(this, 'TimeDepositsTableName', {
      value: this.timeDepositsTable.tableName,
      description: 'DynamoDB table name for time deposits',
      exportName: 'TimeDepositsTableName',
    });

    new cdk.CfnOutput(this, 'TimeDepositsTableArn', {
      value: this.timeDepositsTable.tableArn,
      description: 'DynamoDB table ARN for time deposits',
      exportName: 'TimeDepositsTableArn',
    });

    new cdk.CfnOutput(this, 'WithdrawalsTableName', {
      value: this.withdrawalsTable.tableName,
      description: 'DynamoDB table name for withdrawals',
      exportName: 'WithdrawalsTableName',
    });

    new cdk.CfnOutput(this, 'WithdrawalsTableArn', {
      value: this.withdrawalsTable.tableArn,
      description: 'DynamoDB table ARN for withdrawals',
      exportName: 'WithdrawalsTableArn',
    });
  }
}
