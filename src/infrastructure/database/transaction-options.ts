/** Prisma interactive transaction defaults (5s) are too low for Vercel + remote Postgres. */
export const DEFAULT_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
} as const;

/** POS sale/return/void: inventory + accounting in one transaction. */
export const POS_TRANSACTION_OPTIONS = {
  maxWait: 15_000,
  timeout: 45_000,
} as const;
