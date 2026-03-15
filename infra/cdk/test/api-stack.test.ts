import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DatabaseStack } from '../lib/database-stack';
import { ApiStack } from '../lib/api-stack';

describe('ApiStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const dbStack = new DatabaseStack(app, 'TestDatabaseStack');
    const apiStack = new ApiStack(app, 'TestApiStack', {
      timeDepositsTable: dbStack.timeDepositsTable,
      withdrawalsTable: dbStack.withdrawalsTable,
      stage: 'test',
    });
    template = Template.fromStack(apiStack);
  });

  // ─── REST API ───────────────────────────────────────────────────────
  describe('API Gateway', () => {
    test('creates a REST API with correct name', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: 'Time Deposit API (test)',
      });
    });

    test('API key source is set to HEADER', () => {
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        ApiKeySourceType: 'HEADER',
      });
    });

    test('stage has X-Ray tracing enabled', () => {
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        TracingEnabled: true,
      });
    });

    test('stage has detailed metrics enabled', () => {
      template.hasResourceProperties('AWS::ApiGateway::Stage', {
        MethodSettings: Match.arrayWith([
          Match.objectLike({
            MetricsEnabled: true,
          }),
        ]),
      });
    });
  });

  // ─── API Key & Usage Plan ──────────────────────────────────────────
  describe('API Key and Usage Plan', () => {
    test('creates an API key', () => {
      template.hasResourceProperties('AWS::ApiGateway::ApiKey', {
        Name: 'time-deposit-api-key-test',
        Description: 'API key for Time Deposit API access (test)',
      });
    });

    test('creates a usage plan with throttling', () => {
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        UsagePlanName: 'time-deposit-usage-plan-test',
        Throttle: {
          RateLimit: 100,
          BurstLimit: 50,
        },
      });
    });

    test('usage plan has monthly quota', () => {
      template.hasResourceProperties('AWS::ApiGateway::UsagePlan', {
        Quota: {
          Limit: 10000,
          Period: 'MONTH',
        },
      });
    });

    test('API key is associated with usage plan', () => {
      template.resourceCountIs('AWS::ApiGateway::UsagePlanKey', 1);
    });
  });

  // ─── Lambda Functions ──────────────────────────────────────────────
  describe('Lambda Functions', () => {
    test('creates exactly 2 Lambda functions', () => {
      template.resourceCountIs('AWS::Lambda::Function', 2);
    });

    test('GET Lambda has correct configuration', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'time-deposit-get-all-test',
        Runtime: 'nodejs20.x',
        Architectures: ['arm64'],
        MemorySize: 256,
        Timeout: 30,
        TracingConfig: { Mode: 'Active' },
      });
    });

    test('UPDATE Lambda has correct configuration', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'time-deposit-update-balances-test',
        Runtime: 'nodejs20.x',
        Architectures: ['arm64'],
        MemorySize: 256,
        Timeout: 60,
        TracingConfig: { Mode: 'Active' },
      });
    });

    test('GET Lambda has required environment variables', () => {
      template.hasResourceProperties('AWS::Lambda::Function', {
        FunctionName: 'time-deposit-get-all-test',
        Environment: {
          Variables: Match.objectLike({
            WITHDRAWALS_BY_DEPOSIT_INDEX: 'timeDepositId-index',
          }),
        },
      });
    });

    test('Lambda log groups have 1 month retention', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 30,
      });
    });
  });

  // ─── API Methods ──────────────────────────────────────────────────
  describe('API Methods', () => {
    test('GET method requires API key', () => {
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'GET',
        ApiKeyRequired: true,
      });
    });

    test('POST method requires API key', () => {
      template.hasResourceProperties('AWS::ApiGateway::Method', {
        HttpMethod: 'POST',
        ApiKeyRequired: true,
      });
    });
  });

  // ─── IAM Permissions (Least Privilege) ────────────────────────────
  describe('IAM Permissions', () => {
    test('creates IAM policies for Lambda-DynamoDB access', () => {
      // Verify that DynamoDB read permissions are granted (CDK auto-generates these)
      // The Scan action is critical for both Lambdas to read all time deposits
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: {
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'dynamodb:Scan',
              ]),
              Effect: 'Allow',
            }),
          ]),
        },
      });
    });
  });

  // ─── Access Logs ──────────────────────────────────────────────────
  describe('Access Logs', () => {
    test('creates CloudWatch log group for API access logs', () => {
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        LogGroupName: '/aws/apigateway/time-deposit-api-test',
        RetentionInDays: 30,
      });
    });
  });

  // ─── Outputs ──────────────────────────────────────────────────────
  test('exports API URL and key ID', () => {
    template.hasOutput('ApiUrl', {});
    template.hasOutput('ApiKeyId', {});
    template.hasOutput('GetTimeDepositsEndpoint', {});
    template.hasOutput('UpdateBalancesEndpoint', {});
  });
});
