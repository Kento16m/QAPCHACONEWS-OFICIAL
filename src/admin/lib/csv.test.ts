import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("writes a header and rows", () => {
    expect(toCsv(["a", "b"], [["1", "2"]])).toBe("a,b\r\n1,2");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(toCsv(["x"], [['uno, "dos"\nfin']])).toBe('x\r\n"uno, ""dos""\nfin"');
  });

  it.each(["=SUMA(A1)", "+54", "-1", "@cmd", "\tx", "\rx"])(
    "stops a spreadsheet from running %j as a formula",
    (value) => {
      expect(
        toCsv(["x"], [[value]])
          .split("\r\n")[1]
          ?.replace(/^"/, ""),
      ).toMatch(/^'/);
    },
  );

  it("handles empty values", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("a,b\r\n,");
  });
});
