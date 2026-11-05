import { describe, expect, it } from "vitest";
import { describeRoleChange } from "./manage";

describe("describeRoleChange", () => {
  it("says the roles in Spanish", () => {
    expect(describeRoleChange("Ana: reader a admin")).toBe("Ana: Lector a Administrador");
    expect(describeRoleChange("Ana: admin a editor")).toBe("Ana: Administrador a Editor");
  });

  it("does not touch a name that looks like a role", () => {
    expect(describeRoleChange("admin a editor: editor a reader")).toBe(
      "admin a editor: Editor a Lector",
    );
  });
});
