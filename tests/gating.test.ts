import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FEATURES } from "@/lib/gating";

// La lista de features en TS tiene que ser exactamente la del catálogo de la
// base: la migración 250_catalog más las que se suman después con
// `insert into public.plan_features (plan, feature) values ('estudio', 'x')`.
describe("catálogo de features", () => {
  it("coincide con plan_features de las migraciones", () => {
    const sql = readFileSync("supabase/migrations/20261005000250_catalog.sql", "utf8");
    const block = sql.slice(sql.indexOf("with core(feature)"), sql.indexOf("insert into public.plan_features"));
    const fromCatalog = [...block.matchAll(/\('([a-z_]+)'\)/g)].map((m) => m[1]!);

    const later = readdirSync("supabase/migrations")
      .filter((f) => f > "20261005000250_catalog.sql")
      .flatMap((f) => {
        const text = readFileSync(`supabase/migrations/${f}`, "utf8");
        return [...text.matchAll(/\('(?:profe|inicial|estudio|pro)', '([a-z_]+)'\)/g)].map((m) => m[1]!);
      });

    const fromSql = [...new Set([...fromCatalog, ...later])].sort();
    expect([...FEATURES].sort()).toEqual(fromSql);
  });
});
