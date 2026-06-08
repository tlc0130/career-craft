import { describe, it, expect } from "vitest";
import { decideCredit, CREDIT_WINDOW_MS } from "./creditPolicy";

const NOW = 1_700_000_000_000; // fixed clock for deterministic tests

describe("decideCredit", () => {
  it("gives pro and lifetime accounts unlimited access", () => {
    for (const plan of ["pro", "lifetime"]) {
      const d = decideCredit(
        { plan, lifetimeAccess: false, aiCreditsUsed: 999, aiCreditsResetAt: NOW + 1000 },
        NOW,
        3,
      );
      expect(d).toEqual({ allowed: true, unlimited: true });
    }
  });

  it("treats lifetimeAccess=true as unlimited regardless of plan label", () => {
    const d = decideCredit(
      { plan: "starter", lifetimeAccess: true, aiCreditsUsed: 100, aiCreditsResetAt: NOW + 1000 },
      NOW,
      3,
    );
    expect(d).toEqual({ allowed: true, unlimited: true });
  });

  it("allows a starter user under the limit within an active window", () => {
    const d = decideCredit(
      { plan: "starter", lifetimeAccess: false, aiCreditsUsed: 1, aiCreditsResetAt: NOW + 1000 },
      NOW,
      3,
    );
    expect(d.allowed).toBe(true);
    expect(d).toMatchObject({ unlimited: false, windowReset: false, resetAt: NOW + 1000 });
  });

  it("blocks a starter user who has hit the limit in an active window", () => {
    const d = decideCredit(
      { plan: "starter", lifetimeAccess: false, aiCreditsUsed: 3, aiCreditsResetAt: NOW + 1000 },
      NOW,
      3,
    );
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/Upgrade to Pro/);
  });

  it("rolls an expired window: usage resets and the request is allowed", () => {
    const d = decideCredit(
      { plan: "starter", lifetimeAccess: false, aiCreditsUsed: 3, aiCreditsResetAt: NOW - 1 },
      NOW,
      3,
    );
    expect(d.allowed).toBe(true);
    expect(d).toMatchObject({ unlimited: false, windowReset: true, resetAt: NOW + CREDIT_WINDOW_MS });
  });

  it("treats a never-initialised reset timestamp as an expired window", () => {
    const d = decideCredit(
      { plan: "starter", lifetimeAccess: false, aiCreditsUsed: 5, aiCreditsResetAt: 0 },
      NOW,
      3,
    );
    expect(d.allowed).toBe(true);
    if (d.allowed && !d.unlimited) expect(d.windowReset).toBe(true);
  });
});
