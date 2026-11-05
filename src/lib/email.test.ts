import { describe, expect, it } from "vitest";
import { parseEmail } from "@/lib/email";

describe("parseEmail", () => {
  it("returns a valid address without surrounding spaces", () => {
    expect(parseEmail("  ana@chaco.com.py ")).toBe("ana@chaco.com.py");
  });

  it.each(["", "   ", "ana", "ana@", "@chaco.com", "ana@chaco", "a na@chaco.com", "a@b@c.com"])(
    "rejects %j",
    (value) => {
      expect(parseEmail(value)).toBeNull();
    },
  );

  it("rejects an address longer than the database allows", () => {
    expect(parseEmail(`${"a".repeat(250)}@chaco.com`)).toBeNull();
  });
});
