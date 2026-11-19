import type { TeamApiClient } from "./teamContracts";

export interface SimilarityResult {
  id: string; method: string; createdAt: string; featureNames: string[]; note: string;
  clusters: { clusterId: number; scenarioVersionIds: string[] }[];
  pairs: { leftVersionId: string; rightVersionId: string; distance: number; similarity: number }[];
}
export const similarityApi = (client: TeamApiClient) => ({
  compare: (scenarioVersionIds: string[], method: "gower" | "dtw", clusterThreshold: number) => client.request<SimilarityResult>("/api/v1/prioritization/compare", { method: "POST", body: JSON.stringify({ scenarioVersionIds, method, clusterThreshold }) }),
  get: (id: string) => client.request<SimilarityResult>(`/api/v1/prioritization/compare/${encodeURIComponent(id)}`),
});
