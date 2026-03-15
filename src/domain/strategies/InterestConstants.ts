/**
 * Domain constants for interest calculation.
 *
 * Centralised here so that:
 *  - Magic numbers are eliminated from strategy implementations.
 *  - Shared thresholds (e.g. the universal 30-day grace period) are defined once.
 *  - Plan-specific rates and thresholds are co-located and easily auditable.
 */

/** Number of months in a year — used to convert annual rates to monthly */
export const MONTHS_IN_YEAR = 12;

// ─── Universal Rules ────────────────────────────────────────────────────────

/**
 * No interest is applied for ANY plan during the first 30 days.
 * This is a universal business rule stated in the requirements:
 *   "No interest is applied for the first 30 days for any existing plans."
 *
 * Assumption: "first 30 days" means interest starts when days > 30
 * (i.e., day 31 onwards), matching the original implementation's `days > 30`.
 */
export const MIN_DAYS_FOR_INTEREST = 30;

// ─── Basic Plan ─────────────────────────────────────────────────────────────

/** Annual interest rate for the Basic plan: 1% */
export const BASIC_ANNUAL_RATE = 0.01;

// ─── Student Plan ───────────────────────────────────────────────────────────

/** Annual interest rate for the Student plan: 3% */
export const STUDENT_ANNUAL_RATE = 0.03;

/**
 * Student plan stops earning interest after 1 year.
 * Assumption: "no interest after 1 year" means interest is paid while
 * days < 366 (i.e., up to and including day 365), matching the original
 * implementation's `days < 366`.
 */
export const STUDENT_MAX_DAYS = 366;

// ─── Premium Plan ───────────────────────────────────────────────────────────

/** Annual interest rate for the Premium plan: 5% */
export const PREMIUM_ANNUAL_RATE = 0.05;

/**
 * Premium plan interest starts after 45 days.
 * Assumption: "interest starts after 45 days" means days > 45
 * (i.e., day 46 onwards), matching the original implementation's `days > 45`.
 *
 * Note: This is MORE restrictive than the universal 30-day rule.
 * The premium strategy checks for > 45, which implicitly satisfies > 30.
 */
export const PREMIUM_MIN_DAYS = 45;
