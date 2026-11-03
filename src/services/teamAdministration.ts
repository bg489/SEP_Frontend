import type { TeamApiClient, TeamPage } from "./teamContracts";
import type { OracleConfig } from "./teamOperations";

export interface ManagedUser { id: string; displayName: string; email: string; role: string; isActive: boolean }
export interface ManagedWorker {
  id: string; name: string; host: string; rpcPort: number; capacity: number; activeRuns: number;
  availableCapacity: number; enabled: boolean; health: string; quality: string; carlaVersion: string;
  maps: string[]; lastHeartbeatAt: string | null; lastError: string | null;
}
export interface AdminOracle extends OracleConfig { isActive: boolean }
export type OracleInput = Pick<OracleConfig, "name" | "description" | "speedingToleranceKmh" | "speedingMinDurationS" | "freezingMaxStillS" | "ttcThresholdS" | "routeGoalToleranceM">;
export interface SystemSettings {
  similarityWarningPercent: number; similarityBlockPercent: number; retentionDays: number; retentionEnabled: boolean;
  activeOracleConfigId: string | null; updatedAt: string; retentionNotice?: string;
}
export interface AuditEntry { id: number; action: string; entityType: string; entityId: string; actorId: string; createdAt: string; details: unknown }

export function administrationApi(client: TeamApiClient) {
  const write = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
  const id = encodeURIComponent;
  return {
    users: (query = "", page = 1) => client.request<TeamPage<ManagedUser>>(`/api/v1/admin/users?search=${id(query)}&page=${page}&pageSize=25`),
    updateUser: (userId: string, patch: { role?: string; isActive?: boolean }) => client.request<ManagedUser>(`/api/v1/admin/users/${id(userId)}`, write("PATCH", patch)),
    workers: () => client.request<ManagedWorker[]>("/api/v1/workers"),
    registerWorker: (body: { name: string; host: string; rpcPort: number; capacity: number; carlaVersion: string; maps: string[] }) => client.request<ManagedWorker>("/api/v1/workers", write("POST", body)),
    updateWorker: (worker: ManagedWorker, enabled: boolean) => client.request<ManagedWorker>(`/api/v1/workers/${id(worker.id)}`, write("PATCH", { enabled, capacity: worker.capacity })),
    recoverLost: () => client.request<unknown>("/api/v1/workers/recover-lost", { method: "POST" }),
    oracles: () => client.request<AdminOracle[]>("/api/v1/admin/oracle-configs"),
    createOracle: (body: OracleInput) => client.request<AdminOracle>("/api/v1/admin/oracle-configs", write("POST", body)),
    activateOracle: (oracleId: string) => client.request<SystemSettings>(`/api/v1/admin/oracle-configs/${id(oracleId)}/activate`, { method: "POST" }),
    settings: () => client.request<SystemSettings>("/api/v1/admin/settings"),
    saveSettings: (body: SystemSettings) => client.request<SystemSettings>("/api/v1/admin/settings", write("PUT", body)),
    audit: (page = 1) => client.request<AuditEntry[]>(`/api/v1/admin/audit?page=${page}&pageSize=50`),
  };
}
