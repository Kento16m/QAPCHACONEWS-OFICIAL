// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertTestTarget } from "./test-target.mjs";

describe("assertTestTarget", () => {
  it.each(["nkkgwjvmdxggvyzehlzp", "ooswoucakxnymtdblrzd"])("refuses the real project %s", (ref) => {
    expect(() => assertTestTarget(ref)).toThrow(/datos reales/);
    expect(() => assertTestTarget(`https://${ref}.supabase.co`)).toThrow(/datos reales/);
  });

  it("accepts the test project", () => {
    expect(() => assertTestTarget("qxopaequrjeddaraldvp")).not.toThrow();
    expect(() => assertTestTarget("https://qxopaequrjeddaraldvp.supabase.co")).not.toThrow();
  });
});
