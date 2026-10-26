// Workflow mocks never enable a fake authenticated user. Development access
// requires an explicit setting matching the team's backend configuration.
export const isAuthApiEnabled = true;
export const isTeamDevAuth = (import.meta.env.VITE_AUTH_MODE ?? "Supabase").toLowerCase() === "dev";
export const teamAuthMode = isTeamDevAuth ? "Dev" : "Supabase";

export const authApiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? ""
).replace(/\/$/, "");
