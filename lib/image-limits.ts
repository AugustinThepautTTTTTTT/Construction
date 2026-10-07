// Server-only tester allowance. Entitlement and shared AI budget checks still apply.
export function imageLimits(email: string, env: Record<string, string | undefined> = process.env) {
  const testers = (env.ROOMWISE_TESTER_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  const tester = testers.includes(email.trim().toLowerCase());
  return tester ? { daily: 20, perRoom: 10 } : { daily: 4, perRoom: 2 };
}
