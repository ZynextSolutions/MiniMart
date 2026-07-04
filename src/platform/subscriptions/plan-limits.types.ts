export type PlanLimits = {
  maxBranches?: number;
  maxUsers?: number;
  maxProducts?: number;
  maxWarehouses?: number;
  modules?: Partial<Record<string, boolean>>;
};

export type NumericPlanLimits = Omit<PlanLimits, "modules">;

export type PlanFeature = string;

export const DEFAULT_PLAN_LIMITS: PlanLimits = {
  maxBranches: 1,
  maxUsers: 3,
  maxProducts: 100,
  maxWarehouses: 1,
};

export const PLAN_FEATURES = {
  POS_OFFLINE: "pos.offline",
  ACCOUNTING_ADVANCED: "accounting.advanced",
  REPORTS_EXPORT: "reports.export",
  MULTI_BRANCH: "multi.branch",
  API_ACCESS: "api.access",
} as const;
