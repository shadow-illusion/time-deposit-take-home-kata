#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { ApiStack } from '../lib/api-stack';
import { ObservabilityStack } from '../lib/observability-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Stack naming follows: <Project>-<Component>-<Stage> convention
const stage = app.node.tryGetContext('stage') ?? 'dev';

// --- Database Stack: DynamoDB tables for time deposits and withdrawals ---
const databaseStack = new DatabaseStack(app, `TimeDeposit-Database-${stage}`, {
  env,
  description: 'DynamoDB tables for time deposits and withdrawals',
});

// --- API Stack: API Gateway + Lambda functions ---
const apiStack = new ApiStack(app, `TimeDeposit-Api-${stage}`, {
  env,
  description: 'REST API Gateway with Lambda integrations for time deposit operations',
  timeDepositsTable: databaseStack.timeDepositsTable,
  withdrawalsTable: databaseStack.withdrawalsTable,
  stage,
});
apiStack.addDependency(databaseStack);

// --- Observability Stack: CloudWatch Dashboard, Alarms, Metrics ---
const observabilityStack = new ObservabilityStack(app, `TimeDeposit-Observability-${stage}`, {
  env,
  description: 'CloudWatch monitoring dashboard, alarms, and metrics for the Time Deposit system',
  api: apiStack.api,
  getTimeDepositsFunction: apiStack.getTimeDepositsFunction,
  updateBalancesFunction: apiStack.updateBalancesFunction,
  timeDepositsTable: databaseStack.timeDepositsTable,
  withdrawalsTable: databaseStack.withdrawalsTable,
});
observabilityStack.addDependency(apiStack);

// Apply tags to all resources for cost tracking and governance
cdk.Tags.of(app).add('Project', 'TimeDeposit');
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('Stage', stage);
