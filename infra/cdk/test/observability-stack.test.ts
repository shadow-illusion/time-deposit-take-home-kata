import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DatabaseStack } from '../lib/database-stack';
import { ApiStack } from '../lib/api-stack';
import { ObservabilityStack } from '../lib/observability-stack';

describe('ObservabilityStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const dbStack = new DatabaseStack(app, 'TestDatabaseStack');
    const apiStack = new ApiStack(app, 'TestApiStack', {
      timeDepositsTable: dbStack.timeDepositsTable,
      withdrawalsTable: dbStack.withdrawalsTable,
      stage: 'test',
    });
    const obsStack = new ObservabilityStack(app, 'TestObservabilityStack', {
      api: apiStack.api,
      getTimeDepositsFunction: apiStack.getTimeDepositsFunction,
      updateBalancesFunction: apiStack.updateBalancesFunction,
      timeDepositsTable: dbStack.timeDepositsTable,
      withdrawalsTable: dbStack.withdrawalsTable,
    });
    template = Template.fromStack(obsStack);
  });

  // ─── CloudWatch Dashboard ─────────────────────────────────────────
  describe('CloudWatch Dashboard', () => {
    test('creates a dashboard with correct name', () => {
      template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardName: 'TimeDeposit-Dashboard',
      });
    });

    test('dashboard body contains widget definitions', () => {
      // DashboardBody is an Fn::Join intrinsic function, so we verify
      // it exists as an object (CDK serialises widget JSON with Fn::Join)
      template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
        DashboardBody: Match.objectLike({
          'Fn::Join': Match.anyValue(),
        }),
      });
    });
  });

  // ─── API Gateway Alarms ───────────────────────────────────────────
  describe('API Gateway Alarms', () => {
    test('creates 5XX error alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'TimeDeposit-API-5XX-Errors',
        Threshold: 5,
        EvaluationPeriods: 2,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
        TreatMissingData: 'notBreaching',
      });
    });

    test('creates high latency alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'TimeDeposit-API-High-Latency',
        Threshold: 5000,
        EvaluationPeriods: 3,
        ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      });
    });
  });

  // ─── Lambda Alarms ────────────────────────────────────────────────
  describe('Lambda Alarms', () => {
    test('creates GetTimeDeposits error alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'TimeDeposit-GetTimeDeposits-Errors',
        Threshold: 3,
        EvaluationPeriods: 2,
      });
    });

    test('creates UpdateBalances error alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'TimeDeposit-UpdateBalances-Errors',
        Threshold: 3,
        EvaluationPeriods: 2,
      });
    });

    test('creates GetTimeDeposits throttle alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'TimeDeposit-GetTimeDeposits-Throttles',
        Threshold: 1,
      });
    });

    test('creates UpdateBalances throttle alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'TimeDeposit-UpdateBalances-Throttles',
        Threshold: 1,
      });
    });

    test('creates GetTimeDeposits high duration alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'TimeDeposit-GetTimeDeposits-High-Duration',
        Threshold: 10000,
        EvaluationPeriods: 3,
      });
    });

    test('creates UpdateBalances high duration alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'TimeDeposit-UpdateBalances-High-Duration',
        Threshold: 10000,
        EvaluationPeriods: 3,
      });
    });
  });

  // ─── DynamoDB Alarms ──────────────────────────────────────────────
  describe('DynamoDB Alarms', () => {
    test('creates TimeDeposits throttle alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'TimeDeposit-DynamoDB-TimeDeposits-Throttles',
      });
    });

    test('creates Withdrawals throttle alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'TimeDeposit-DynamoDB-Withdrawals-Throttles',
      });
    });

    test('creates TimeDeposits system error alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'TimeDeposit-DynamoDB-TimeDeposits-SystemErrors',
      });
    });

    test('creates Withdrawals system error alarm', () => {
      template.hasResourceProperties('AWS::CloudWatch::Alarm', {
        AlarmName: 'TimeDeposit-DynamoDB-Withdrawals-SystemErrors',
      });
    });
  });

  // ─── Alarm Count ──────────────────────────────────────────────────
  test('creates the expected total number of alarms', () => {
    // 2 API GW + 6 Lambda (3 per function × 2) + 4 DynamoDB (2 per table × 2) = 12
    template.resourceCountIs('AWS::CloudWatch::Alarm', 12);
  });

  // ─── Outputs ──────────────────────────────────────────────────────
  test('exports dashboard URL', () => {
    template.hasOutput('DashboardUrl', {});
  });
});
