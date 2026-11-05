import { describe, expect, it } from "vitest";
import { panelAccess } from "./access";

const base = {
  hasSession: true,
  role: "editor" as const,
  isBlocked: false,
  aal: "aal1" as const,
  factorCount: 0,
  requireMfa: false,
};

describe("panelAccess", () => {
  it.each([
    ["no session", { hasSession: false, role: null }, "signin"],
    ["reader", { role: "reader" as const }, "denied"],
    ["session without profile", { role: null }, "denied"],
    ["blocked editor", { isBlocked: true }, "blocked"],
    [
      "blocked admin with a factor",
      { role: "admin" as const, isBlocked: true, factorCount: 1 },
      "blocked",
    ],
    ["editor without factor", {}, "ok"],
    ["editor without factor when required", { requireMfa: true }, "ok"],
    ["editor with factor not yet verified", { factorCount: 1 }, "verify"],
    ["editor verified", { factorCount: 1, aal: "aal2" as const }, "ok"],
    ["admin without factor, required", { role: "admin" as const, requireMfa: true }, "enroll"],
    ["admin without factor, not required yet", { role: "admin" as const }, "ok"],
    ["admin with factor not yet verified", { role: "admin" as const, factorCount: 1 }, "verify"],
    [
      "admin verified",
      { role: "admin" as const, factorCount: 2, aal: "aal2" as const, requireMfa: true },
      "ok",
    ],
  ])("%s", (_name, input, expected) => {
    expect(panelAccess({ ...base, ...input })).toBe(expected);
  });
});
