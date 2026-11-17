import { describe, expect, it } from "vitest";
import { homePathForRole, isProtectedPath, safeNextPath } from "@/lib/auth/paths";

describe("isProtectedPath", () => {
  it("protects signed-in areas and their sub-pages", () => {
    for (const p of ["/dashboard", "/dashboard/clients/1", "/team", "/home", "/no-access"]) {
      expect(isProtectedPath(p)).toBe(true);
    }
  });

  it("leaves public pages open, including look-alike paths", () => {
    for (const p of ["/", "/login", "/auth/callback", "/api/health", "/homepage", "/teams"]) {
      expect(isProtectedPath(p)).toBe(false);
    }
  });
});

describe("homePathForRole", () => {
  it("sends each role to its own home", () => {
    expect(homePathForRole("admin")).toBe("/dashboard");
    expect(homePathForRole("manager")).toBe("/dashboard");
    expect(homePathForRole("client")).toBe("/home");
    expect(homePathForRole(null)).toBe("/no-access");
  });
});

describe("safeNextPath (open-redirect guard)", () => {
  it("allows same-site paths", () => {
    expect(safeNextPath("/team")).toBe("/team");
    expect(safeNextPath("/dashboard?x=1")).toBe("/dashboard?x=1");
  });

  it("rejects anything that could leave the site", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "evil",
      "",
      null,
      undefined,
    ]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });
});
