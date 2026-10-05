import { describe, expect, it } from "vitest";
import { balanceHint, canJoinAs } from "@/lib/role-balance";

describe("balance de roles (misma regla que book_session)", () => {
  it("sin balance entra cualquiera", () => {
    expect(canJoinAs("leader", { leaders: 10, followers: 0, maxDiff: null })).toBe(true);
    expect(balanceHint({ leaders: 10, followers: 0, maxDiff: null })).toBeNull();
  });

  it("clase vacía con diferencia 1: entran ambos", () => {
    expect(canJoinAs("leader", { leaders: 0, followers: 0, maxDiff: 1 })).toBe(true);
    expect(canJoinAs("follower", { leaders: 0, followers: 0, maxDiff: 1 })).toBe(true);
  });

  it("con un líder de más y diferencia 1, faltan seguidores", () => {
    const counts = { leaders: 3, followers: 2, maxDiff: 1 };
    expect(canJoinAs("leader", counts)).toBe(false);
    expect(canJoinAs("follower", counts)).toBe(true);
    expect(balanceHint(counts)).toBe("Faltan seguidores/as");
  });

  it("con diferencia 2 todavía entra un líder más", () => {
    expect(canJoinAs("leader", { leaders: 3, followers: 2, maxDiff: 2 })).toBe(true);
    expect(canJoinAs("leader", { leaders: 4, followers: 2, maxDiff: 2 })).toBe(false);
  });

  it("faltan líderes", () => {
    expect(balanceHint({ leaders: 1, followers: 2, maxDiff: 1 })).toBe("Faltan líderes");
  });
});
