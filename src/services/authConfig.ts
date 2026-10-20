// Authentication always goes through the .NET API. Mock data mode only
// controls scenario-management data and must never create a local user session.
export const isAuthApiEnabled = true;

export const authApiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5080"
).replace(/\/$/, "");
