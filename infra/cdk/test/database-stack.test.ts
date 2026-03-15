import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DatabaseStack } from '../lib/database-stack';

describe('DatabaseStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new DatabaseStack(app, 'TestDatabaseStack');
    template = Template.fromStack(stack);
  });

  // ─── Table Count ────────────────────────────────────────────────────
  test('creates exactly 2 DynamoDB tables', () => {
    template.resourceCountIs('AWS::DynamoDB::Table', 2);
  });

  // ─── TimeDeposits Table ─────────────────────────────────────────────
  describe('TimeDeposits table', () => {
    test('has correct table name', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'timeDeposits',
      });
    });

    test('has id as NUMBER partition key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'timeDeposits',
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' },
        ],
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: 'id', AttributeType: 'N' },
        ]),
      });
    });

    test('uses PAY_PER_REQUEST billing mode', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'timeDeposits',
        BillingMode: 'PAY_PER_REQUEST',
      });
    });

    test('has point-in-time recovery enabled', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'timeDeposits',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      });
    });

    test('has deletion protection enabled', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'timeDeposits',
        DeletionProtectionEnabled: true,
      });
    });

    test('has RETAIN deletion policy', () => {
      template.hasResource('AWS::DynamoDB::Table', {
        Properties: { TableName: 'timeDeposits' },
        DeletionPolicy: 'Retain',
        UpdateReplacePolicy: 'Retain',
      });
    });
  });

  // ─── Withdrawals Table ──────────────────────────────────────────────
  describe('Withdrawals table', () => {
    test('has correct table name', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'withdrawals',
      });
    });

    test('has id as NUMBER partition key', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'withdrawals',
        KeySchema: [
          { AttributeName: 'id', KeyType: 'HASH' },
        ],
        AttributeDefinitions: Match.arrayWith([
          { AttributeName: 'id', AttributeType: 'N' },
        ]),
      });
    });

    test('has GSI on timeDepositId', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'withdrawals',
        GlobalSecondaryIndexes: Match.arrayWith([
          Match.objectLike({
            IndexName: 'timeDepositId-index',
            KeySchema: [
              { AttributeName: 'timeDepositId', KeyType: 'HASH' },
            ],
            Projection: { ProjectionType: 'ALL' },
          }),
        ]),
      });
    });

    test('uses PAY_PER_REQUEST billing mode', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'withdrawals',
        BillingMode: 'PAY_PER_REQUEST',
      });
    });

    test('has point-in-time recovery enabled', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'withdrawals',
        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },
      });
    });

    test('has deletion protection enabled', () => {
      template.hasResourceProperties('AWS::DynamoDB::Table', {
        TableName: 'withdrawals',
        DeletionProtectionEnabled: true,
      });
    });
  });

  // ─── Outputs ────────────────────────────────────────────────────────
  test('exports table names and ARNs', () => {
    template.hasOutput('TimeDepositsTableName', {});
    template.hasOutput('TimeDepositsTableArn', {});
    template.hasOutput('WithdrawalsTableName', {});
    template.hasOutput('WithdrawalsTableArn', {});
  });
});
