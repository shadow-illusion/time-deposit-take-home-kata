import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBTimeDepositRepository } from '../../../../src/adapters/driven/DynamoDBTimeDepositRepository';
import { DynamoDBWithdrawalRepository } from '../../../../src/adapters/driven/DynamoDBWithdrawalRepository';
import { GetTimeDepositsUseCase } from '../../../../src/application/GetTimeDepositsUseCase';

/**
 * Lambda handler: GET /time-deposits
 *
 * This is a THIN DRIVING ADAPTER in hexagonal architecture.
 * It only:
 *   1. Reads config from environment variables
 *   2. Wires up the driven adapters (DynamoDB repositories)
 *   3. Delegates to the use case
 *   4. Maps the result to an HTTP response
 *
 * All business logic lives in GetTimeDepositsUseCase.
 * All data access logic lives in the DynamoDB adapters.
 * Swapping DynamoDB for another DB requires NO changes here — only a different adapter.
 */

// Initialise AWS clients outside the handler for connection reuse across invocations
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const TIME_DEPOSITS_TABLE = process.env.TIME_DEPOSITS_TABLE!;
const WITHDRAWALS_TABLE = process.env.WITHDRAWALS_TABLE!;
const WITHDRAWALS_BY_DEPOSIT_INDEX = process.env.WITHDRAWALS_BY_DEPOSIT_INDEX ?? 'timeDepositId-index';

// Wire driven adapters → use case (composition root for Lambda)
const timeDepositRepo = new DynamoDBTimeDepositRepository(docClient, TIME_DEPOSITS_TABLE);
const withdrawalRepo = new DynamoDBWithdrawalRepository(docClient, WITHDRAWALS_TABLE, WITHDRAWALS_BY_DEPOSIT_INDEX);
const useCase = new GetTimeDepositsUseCase(timeDepositRepo, withdrawalRepo);

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId ?? context.awsRequestId;

  console.log(JSON.stringify({
    message: 'GET /time-deposits – Request received',
    requestId,
  }));

  try {
    const result = await useCase.execute();

    console.log(JSON.stringify({
      message: 'GET /time-deposits – Success',
      requestId,
      depositCount: result.length,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Request-Id': requestId,
      },
      body: JSON.stringify({
        data: result,
        metadata: {
          count: result.length,
          requestId,
        },
      }),
    };
  } catch (error) {
    console.error(JSON.stringify({
      message: 'GET /time-deposits – Error',
      requestId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Request-Id': requestId,
      },
      body: JSON.stringify({
        message: 'Internal server error',
        requestId,
      }),
    };
  }
};
