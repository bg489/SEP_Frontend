import type { UserRole } from "../types";
import { authApiBaseUrl, isTeamDevAuth } from "./authConfig";

export const devRoles = ["SCENARIO_ENGINEER", "TEST_ENGINEER", "TEST_REVIEWER", "ADMIN"] as const;
export type DevRole = typeof devRoles[number];
const key = `autoscenariox.team-api.dev-role:${authApiBaseUrl || "same-origin"}`;
let selected: DevRole | undefined;

export function isDevRole(value: unknown): value is DevRole {
  return typeof value === "string" && devRoles.some(role => role === value);
}

export function getDevRole(): DevRole {
  if (selected) return selected;
  try {
    const saved = sessionStorage.getItem(key);
    if (isDevRole(saved)) return selected = saved;
  } catch { /* The role also works in memory when session storage is unavailable. */ }
  return selected = "SCENARIO_ENGINEER";
}

export function setDevRole(role: DevRole): void {
  if (!isTeamDevAuth) throw new Error("Role switching is available only in Dev authentication mode.");
  if (!isDevRole(role)) throw new Error("Unsupported development role.");
  selected = role;
  try { sessionStorage.setItem(key, role); } catch { /* Keep the selection in memory. */ }
}

export function devRoleToUserRole(role: DevRole): UserRole {
  return { SCENARIO_ENGINEER: "Scenario Engineer", TEST_ENGINEER: "Test Engineer",
    TEST_REVIEWER: "Test Reviewer", ADMIN: "Administrator" }[role] as UserRole;
}
