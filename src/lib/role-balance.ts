// Misma regla que book_session en la base: un rol puede anotarse si
// (mismo_rol + 1) - otro_rol <= max_diff. Acá se usa solo para mostrar;
// la que decide es la RPC.

export type Role = "leader" | "follower";

export type RoleCounts = { leaders: number; followers: number; maxDiff: number | null };

export function canJoinAs(role: Role, { leaders, followers, maxDiff }: RoleCounts): boolean {
  if (maxDiff === null) return true;
  const same = role === "leader" ? leaders : followers;
  const other = role === "leader" ? followers : leaders;
  return same + 1 - other <= maxDiff;
}

/**
 * Mensaje corto para la grilla: qué rol se necesita, o null si entran ambos.
 * Ej.: "Faltan seguidores/as" cuando ya no entran más líderes.
 */
export function balanceHint(counts: RoleCounts): string | null {
  const leaderOk = canJoinAs("leader", counts);
  const followerOk = canJoinAs("follower", counts);
  if (leaderOk && !followerOk) return "Faltan líderes";
  if (!leaderOk && followerOk) return "Faltan seguidores/as";
  return null;
}
