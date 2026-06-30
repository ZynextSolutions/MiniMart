export async function register() {
  const phase = process.env.NEXT_PHASE;
  const shouldValidate =
    process.env.NEXT_RUNTIME === "nodejs" &&
    (phase === "phase-production-server" || phase === "phase-development-server");

  if (shouldValidate) {
    const { validateEnv } = await import("@/env");
    validateEnv();
  }
}
