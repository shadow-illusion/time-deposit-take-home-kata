import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBTimeDepositRepository } from '../../../../src/adapters/driven/DynamoDBTimeDepositRepository';
import { TimeDepositCalculator } from '../../../../src/domain';
import { UpdateBalancesUseCase } from '../../../../src/application/UpdateBalancesUseCase';

/**
 * Lambda handler: POST /time-deposits/update-balances
 *
 * THIN DRIVING ADAPTER — wires DynamoDB adapter + domain calculator → use case.
 * All business logic is in UpdateBalancesUseCase and TimeDepositCalculator.
 */

// Initialise outside handler for connection reuse across warm invocations
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const TIME_DEPOSITS_TABLE = process.env.TIME_DEPOSITS_TABLE!;

// Wire driven adapters → use case (composition root for Lambda)
const timeDepositRepo = new DynamoDBTimeDepositRepository(docClient, TIME_DEPOSITS_TABLE);
const calculator = new TimeDepositCalculator();
const useCase = new UpdateBalancesUseCase(timeDepositRepo, calculator);

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context,
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId ?? context.awsRequestId;

  console.log(JSON.stringify({
    message: 'POST /time-deposits/update-balances – Request received',
    requestId,
  }));

  try {
    const result = await useCase.execute();

    console.log(JSON.stringify({
      message: 'POST /time-deposits/update-balances – Success',
      requestId,
      updatedCount: result.updatedCount,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Request-Id': requestId,
      },
      body: JSON.stringify({
        message: 'Balances updated successfully',
        metadata: {
          updatedCount: result.updatedCount,
          requestId,
        },
      }),
    };
  } catch (error) {
    console.error(JSON.stringify({
      message: 'POST /time-deposits/update-balances – Error',
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
