import { canAccessRoute, checkRouteAccess, isPublicRoute } from "@/lib/auth/route-access";

describe("route access matrix", () => {
  it("marks marketing and mobile landing pages as public", () => {
    expect(isPublicRoute("/")).toBe(true);
    expect(isPublicRoute("/mobile")).toBe(true);
  });

  it("allows crew and supervisor roles to open equipment verification", () => {
    expect(checkRouteAccess("/mobile/equipment-verification", "crew").allowed).toBe(true);
    expect(checkRouteAccess("/mobile/equipment-verification", "supervisor").allowed).toBe(true);
    expect(checkRouteAccess("/mobile/equipment-verification", "admin").allowed).toBe(true);
  });

  it("blocks crew users from admin control tower", () => {
    expect(checkRouteAccess("/control-tower", "crew").allowed).toBe(false);
    expect(checkRouteAccess("/control-tower", "admin").allowed).toBe(true);
  });

  it("permits crew API access for crew users but not supervisors on admin APIs", () => {
    expect(checkRouteAccess("/api/crew/jobs", "crew").allowed).toBe(true);
    expect(checkRouteAccess("/api/admin/config", "supervisor").allowed).toBe(false);
  });

  it("exposes helper for UI checks", () => {
    expect(canAccessRoute("/supervisor/customers", "supervisor")).toBe(true);
    expect(canAccessRoute("/supervisor/customers", "crew")).toBe(false);
  });
});