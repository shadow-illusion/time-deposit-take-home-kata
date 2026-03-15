/**
 * Shared TypeScript interfaces for Lambda functions.
 * Based on the domain model in src/TimeDeposit.ts and the database schema in README.md.
 *
 * These types represent the DynamoDB item shapes and API response contracts.
 * They are kept separate from the domain model to decouple the infrastructure
 * layer from the domain layer (hexagonal architecture boundary).
 */

/** DynamoDB item shape for the timeDeposits table */
export interface TimeDepositItem {
  /** Primary key – unique identifier for the time deposit */
  id: number;
  /** Plan type: 'basic' | 'student' | 'premium' */
  planType: string;
  /** Current balance in the account (decimal) */
  balance: number;
  /** Number of days since the deposit was opened */
  days: number;
}

/** DynamoDB item shape for the withdrawals table */
export interface WithdrawalItem {
  /** Primary key – unique identifier for the withdrawal */
  id: number;
  /** Foreign key – references timeDeposits.id */
  timeDepositId: number;
  /** Withdrawal amount (decimal) */
  amount: number;
  /** Date of the withdrawal (ISO 8601 string, e.g. "2026-03-14") */
  date: string;
}

/** API response schema for GET /time-deposits as specified in requirements */
export interface TimeDepositResponse {
  id: number;
  planType: string;
  balance: number;
  days: number;
  withdrawals: WithdrawalItem[];
}

/** Standard API error response body */
export interface ErrorResponse {
  message: string;
  requestId?: string;
}
