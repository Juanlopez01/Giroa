import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FEATURES } from "@/lib/gating";

// La lista de features en TS tiene que ser exactamente la del catálogo de la
// base (migración 250_catalog). Si agregás una feature, va en los dos lados.
describe("catálogo de features", () => {
  it("coincide con plan_features de la migración", () => {
    const sql = readFileSync("supabase/migrations/20261005000250_catalog.sql", "utf8");
    const block = sql.slice(sql.indexOf("with core(feature)"), sql.indexOf("insert into public.plan_features"));
    const fromSql = [...block.matchAll(/\('([a-z_]+)'\)/g)].map((m) => m[1]).sort();
    expect([...FEATURES].sort()).toEqual(fromSql);
  });
});
