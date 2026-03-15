import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface ObservabilityStackProps extends cdk.StackProps {
  /** API Gateway REST API instance */
  api: apigateway.RestApi;
  /** Lambda function for GET /time-deposits */
  getTimeDepositsFunction: lambda.Function;
  /** Lambda function for POST /time-deposits/update-balances */
  updateBalancesFunction: lambda.Function;
  /** DynamoDB time deposits table */
  timeDepositsTable: dynamodb.Table;
  /** DynamoDB withdrawals table */
  withdrawalsTable: dynamodb.Table;
}

/**
 * ObservabilityStack provisions CloudWatch monitoring resources for the Time Deposit system.
 *
 * Includes:
 *  - Unified CloudWatch Dashboard with API Gateway, Lambda, and DynamoDB metrics
 *  - CloudWatch Alarms for error detection and operational awareness:
 *    • API Gateway 5xx errors
 *    • API Gateway high p99 latency
 *    • Lambda function errors and throttles
 *    • DynamoDB throttled requests
 *
 * All Lambda functions have X-Ray tracing enabled (configured in ApiStack) for
 * distributed tracing across API Gateway → Lambda → DynamoDB.
 */
export class ObservabilityStack extends cdk.Stack {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const {
      api,
      getTimeDepositsFunction,
      updateBalancesFunction,
      timeDepositsTable,
      withdrawalsTable,
    } = props;

    const lambdaFunctions = [
      { fn: getTimeDepositsFunction, label: 'GetTimeDeposits' },
      { fn: updateBalancesFunction, label: 'UpdateBalances' },
    ];

    const tables = [
      { table: timeDepositsTable, label: 'TimeDeposits' },
      { table: withdrawalsTable, label: 'Withdrawals' },
    ];

    // ═══════════════════════════════════════════════════════════════════════
    //  CloudWatch Dashboard
    // ═══════════════════════════════════════════════════════════════════════
    this.dashboard = new cloudwatch.Dashboard(this, 'TimeDepositDashboard', {
      dashboardName: 'TimeDeposit-Dashboard',
      defaultInterval: cdk.Duration.hours(3),
    });

    // ─── API Gateway Widgets ────────────────────────────────────────────
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway – Request Count',
        left: [api.metricCount({ period: cdk.Duration.minutes(1) })],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway – Latency (ms)',
        left: [
          api.metricLatency({ statistic: 'Average', label: 'Average', period: cdk.Duration.minutes(1) }),
          api.metricLatency({ statistic: 'p99', label: 'p99', period: cdk.Duration.minutes(1) }),
        ],
        width: 12,
        height: 6,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway – 4XX Client Errors',
        left: [api.metricClientError({ period: cdk.Duration.minutes(1) })],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway – 5XX Server Errors',
        left: [api.metricServerError({ period: cdk.Duration.minutes(1) })],
        width: 12,
        height: 6,
      }),
    );

    // ─── Lambda Widgets ─────────────────────────────────────────────────
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda – Invocations',
        left: lambdaFunctions.map(({ fn, label }) =>
          fn.metricInvocations({ label, period: cdk.Duration.minutes(1) }),
        ),
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda – Errors',
        left: lambdaFunctions.map(({ fn, label }) =>
          fn.metricErrors({ label, period: cdk.Duration.minutes(1) }),
        ),
        width: 12,
        height: 6,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda – Duration (ms)',
        left: lambdaFunctions.map(({ fn, label }) =>
          fn.metricDuration({ label, period: cdk.Duration.minutes(1) }),
        ),
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda – Throttles',
        left: lambdaFunctions.map(({ fn, label }) =>
          fn.metricThrottles({ label, period: cdk.Duration.minutes(1) }),
        ),
        width: 12,
        height: 6,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda – Concurrent Executions',
        left: lambdaFunctions.map(({ fn, label }) =>
          fn.metric('ConcurrentExecutions', { label, statistic: 'Maximum', period: cdk.Duration.minutes(1) }),
        ),
        width: 24,
        height: 6,
      }),
    );

    // ─── DynamoDB Widgets ───────────────────────────────────────────────
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB – Consumed Read Capacity Units',
        left: tables.map(({ table, label }) =>
          table.metricConsumedReadCapacityUnits({ label, period: cdk.Duration.minutes(1) }),
        ),
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB – Consumed Write Capacity Units',
        left: tables.map(({ table, label }) =>
          table.metricConsumedWriteCapacityUnits({ label, period: cdk.Duration.minutes(1) }),
        ),
        width: 12,
        height: 6,
      }),
    );

    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB – Successful Request Latency (ms)',
        left: tables.map(({ table, label }) =>
          table.metricSuccessfulRequestLatency({
            label,
            dimensionsMap: { TableName: table.tableName, Operation: 'Scan' },
            period: cdk.Duration.minutes(1),
          }),
        ),
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'DynamoDB – User Errors',
        left: tables.map(({ table, label }) =>
          table.metricUserErrors({ label, period: cdk.Duration.minutes(1) }),
        ),
        width: 12,
        height: 6,
      }),
    );

    // ═══════════════════════════════════════════════════════════════════════
    //  CloudWatch Alarms
    // ═══════════════════════════════════════════════════════════════════════

    // ─── API Gateway Alarms ─────────────────────────────────────────────
    new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      alarmName: 'TimeDeposit-API-5XX-Errors',
      alarmDescription: 'Triggers when the API returns 5+ server errors in a 5-minute window (2 consecutive periods)',
      metric: api.metricServerError({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      alarmName: 'TimeDeposit-API-High-Latency',
      alarmDescription: 'Triggers when API p99 latency exceeds 5 seconds for 3 consecutive 5-minute periods',
      metric: api.metricLatency({
        period: cdk.Duration.minutes(5),
        statistic: 'p99',
      }),
      threshold: 5000,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ─── Lambda Alarms ──────────────────────────────────────────────────
    for (const { fn, label } of lambdaFunctions) {
      new cloudwatch.Alarm(this, `${label}ErrorAlarm`, {
        alarmName: `TimeDeposit-${label}-Errors`,
        alarmDescription: `Triggers when ${label} Lambda has 3+ errors in 2 consecutive 5-minute periods`,
        metric: fn.metricErrors({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 3,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      new cloudwatch.Alarm(this, `${label}ThrottleAlarm`, {
        alarmName: `TimeDeposit-${label}-Throttles`,
        alarmDescription: `Triggers when ${label} Lambda is throttled`,
        metric: fn.metricThrottles({
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      new cloudwatch.Alarm(this, `${label}DurationAlarm`, {
        alarmName: `TimeDeposit-${label}-High-Duration`,
        alarmDescription: `Triggers when ${label} Lambda average duration exceeds 10 seconds`,
        metric: fn.metricDuration({
          period: cdk.Duration.minutes(5),
          statistic: 'Average',
        }),
        threshold: 10000,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }

    // ─── DynamoDB Alarms ────────────────────────────────────────────────
    for (const { table, label } of tables) {
      new cloudwatch.Alarm(this, `${label}ThrottleAlarm`, {
        alarmName: `TimeDeposit-DynamoDB-${label}-Throttles`,
        alarmDescription: `Triggers when ${label} DynamoDB table experiences throttled requests`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'ThrottledRequests',
          dimensionsMap: { TableName: table.tableName },
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 5,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      new cloudwatch.Alarm(this, `${label}SystemErrorAlarm`, {
        alarmName: `TimeDeposit-DynamoDB-${label}-SystemErrors`,
        alarmDescription: `Triggers when ${label} DynamoDB table has system errors`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/DynamoDB',
          metricName: 'SystemErrors',
          dimensionsMap: { TableName: table.tableName },
          period: cdk.Duration.minutes(5),
          statistic: 'Sum',
        }),
        threshold: 1,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }

    // ─── CloudFormation Outputs ─────────────────────────────────────────
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=TimeDeposit-Dashboard`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}
