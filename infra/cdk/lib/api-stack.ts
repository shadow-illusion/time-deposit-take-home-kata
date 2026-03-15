import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  /** DynamoDB table for time deposits */
  timeDepositsTable: dynamodb.Table;
  /** DynamoDB table for withdrawals */
  withdrawalsTable: dynamodb.Table;
  /** Deployment stage (dev, staging, prod) */
  stage: string;
}

/**
 * ApiStack provisions the REST API Gateway and Lambda functions for the Time Deposit system.
 *
 * Endpoints:
 *  - GET  /time-deposits                → Retrieve all time deposits with their withdrawals
 *  - POST /time-deposits/update-balances → Recalculate and update balances for all deposits
 *
 * Security:
 *  - API Key required on all endpoints (passed via x-api-key header)
 *  - Usage plan with throttling and monthly quota
 *  - Lambda functions use least-privilege IAM (only needed DynamoDB actions)
 *  - X-Ray tracing enabled end-to-end
 *  - CloudWatch access logs in JSON format
 */
export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly getTimeDepositsFunction: lambda.Function;
  public readonly updateBalancesFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { timeDepositsTable, withdrawalsTable, stage } = props;

    // ─── Lambda: GET /time-deposits ─────────────────────────────────────
    const getTimeDepositsLogGroup = new logs.LogGroup(this, 'GetTimeDepositsLogGroup', {
      logGroupName: `/aws/lambda/time-deposit-get-all-${stage}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.getTimeDepositsFunction = new lambdaNodejs.NodejsFunction(this, 'GetTimeDepositsFunction', {
      functionName: `time-deposit-get-all-${stage}`,
      description: 'Retrieves all time deposits with associated withdrawal records',
      entry: path.join(__dirname, '..', 'lambdas', 'get-time-deposits', 'index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE, // X-Ray tracing
      logGroup: getTimeDepositsLogGroup,
      environment: {
        TIME_DEPOSITS_TABLE: timeDepositsTable.tableName,
        WITHDRAWALS_TABLE: withdrawalsTable.tableName,
        WITHDRAWALS_BY_DEPOSIT_INDEX: 'timeDepositId-index',
        NODE_OPTIONS: '--enable-source-maps',
        STAGE: stage,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        // Exclude AWS SDK v3 – it's available in the Lambda runtime
        externalModules: ['@aws-sdk/*'],
      },
    });

    // ─── Lambda: POST /time-deposits/update-balances ────────────────────
    const updateBalancesLogGroup = new logs.LogGroup(this, 'UpdateBalancesLogGroup', {
      logGroupName: `/aws/lambda/time-deposit-update-balances-${stage}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.updateBalancesFunction = new lambdaNodejs.NodejsFunction(this, 'UpdateBalancesFunction', {
      functionName: `time-deposit-update-balances-${stage}`,
      description: 'Recalculates and updates balances for all time deposits',
      entry: path.join(__dirname, '..', 'lambdas', 'update-balances', 'index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(60), // Longer timeout for batch processing
      tracing: lambda.Tracing.ACTIVE,
      logGroup: updateBalancesLogGroup,
      environment: {
        TIME_DEPOSITS_TABLE: timeDepositsTable.tableName,
        NODE_OPTIONS: '--enable-source-maps',
        STAGE: stage,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['@aws-sdk/*'],
      },
    });

    // ─── IAM: Least-privilege DynamoDB permissions ──────────────────────
    // GET handler: read-only access to both tables
    timeDepositsTable.grantReadData(this.getTimeDepositsFunction);
    withdrawalsTable.grantReadData(this.getTimeDepositsFunction);

    // UPDATE handler: read+write on timeDeposits only (no withdrawal access needed)
    timeDepositsTable.grantReadWriteData(this.updateBalancesFunction);

    // ─── API Gateway ────────────────────────────────────────────────────
    const apiLogGroup = new logs.LogGroup(this, 'ApiAccessLogs', {
      logGroupName: `/aws/apigateway/time-deposit-api-${stage}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.api = new apigateway.RestApi(this, 'TimeDepositApi', {
      restApiName: `Time Deposit API (${stage})`,
      description: 'RESTful API for managing time deposit balances and retrieving deposit information',
      deployOptions: {
        stageName: stage,
        tracingEnabled: true,           // X-Ray on API Gateway
        metricsEnabled: true,           // CloudWatch detailed metrics
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,        // Do NOT log request/response bodies (security best practice)
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        throttlingBurstLimit: 50,
        throttlingRateLimit: 100,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Api-Key', 'Authorization'],
      },
      apiKeySourceType: apigateway.ApiKeySourceType.HEADER,
    });

    // ─── API Key & Usage Plan ───────────────────────────────────────────
    const apiKey = this.api.addApiKey('TimeDepositApiKey', {
      apiKeyName: `time-deposit-api-key-${stage}`,
      description: `API key for Time Deposit API access (${stage})`,
    });

    const usagePlan = this.api.addUsagePlan('TimeDepositUsagePlan', {
      name: `time-deposit-usage-plan-${stage}`,
      description: `Usage plan with throttling and quota for Time Deposit API (${stage})`,
      throttle: {
        rateLimit: 100,   // requests per second
        burstLimit: 50,   // burst capacity
      },
      quota: {
        limit: 10000,
        period: apigateway.Period.MONTH,
      },
    });

    usagePlan.addApiKey(apiKey);
    usagePlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // ─── Routes ─────────────────────────────────────────────────────────
    const timeDepositsResource = this.api.root.addResource('time-deposits');

    // GET /time-deposits – Retrieve all time deposits with withdrawals
    timeDepositsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(this.getTimeDepositsFunction, {
        proxy: true,
      }),
      {
        apiKeyRequired: true,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '500' },
        ],
      },
    );

    // POST /time-deposits/update-balances – Update all balances
    const updateBalancesResource = timeDepositsResource.addResource('update-balances');
    updateBalancesResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(this.updateBalancesFunction, {
        proxy: true,
      }),
      {
        apiKeyRequired: true,
        methodResponses: [
          { statusCode: '200' },
          { statusCode: '500' },
        ],
      },
    );

    // ─── CloudFormation Outputs ─────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'Time Deposit API base URL',
      exportName: `TimeDepositApiUrl-${stage}`,
    });

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API Key ID – retrieve the actual key value via: aws apigateway get-api-key --api-key <id> --include-value',
      exportName: `TimeDepositApiKeyId-${stage}`,
    });

    new cdk.CfnOutput(this, 'GetTimeDepositsEndpoint', {
      value: `${this.api.url}time-deposits`,
      description: 'GET endpoint to retrieve all time deposits',
    });

    new cdk.CfnOutput(this, 'UpdateBalancesEndpoint', {
      value: `${this.api.url}time-deposits/update-balances`,
      description: 'POST endpoint to update all time deposit balances',
    });
  }
}
