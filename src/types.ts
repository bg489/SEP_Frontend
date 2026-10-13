export type ScenarioStatus = "Approved" | "In review" | "Draft" | "Archived";
export type CampaignStatus =
  "Running" | "Queued" | "Completed" | "Draft" | "Needs review";
export type RunVerdict = "PASS" | "FAIL" | "TIMEOUT";
export type UserRole =
  "Scenario Engineer" | "Test Engineer" | "Test Reviewer" | "Administrator";

export type AppPage =
  | "overview"
  | "scenarios"
  | "campaigns"
  | "priority"
  | "failures"
  | "nodes"
  | "oracles"
  | "scenario-editor"
  | "import"
  | "compare"
  | "clusters"
  | "execution"
  | "run-detail"
  | "review"
  | "report"
  | "users"
  | "analytics"
  | "audit"
  | "profile";

export interface DemoUser {
  name: string;
  email: string;
  role: UserRole;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  map: string;
  category: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  status: ScenarioStatus;
  version: string;
  weather: string;
  actors: number;
  runCount: number;
  passRate: number;
  lastRun: string;
  owner: string;
  tags: string[];
  priorityScore: number;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  scenarioIds: string[];
  strategy: string;
  status: CampaignStatus;
  progress: number;
  owner: string;
  createdAt: string;
  passRate: number;
  failedRuns: number;
  estimatedDuration: string;
}

export interface FailureEvidence {
  timestamp: string;
  rule: string;
  measured: string;
  threshold: string;
  note: string;
}

export interface FailureCluster {
  id: string;
  label: string;
  rootCause: string;
  reviewStatus: "Confirmed" | "Needs review";
  similarity: number;
  affectedRuns: number;
  lastDetected: string;
  map: string;
  scenarioName: string;
  confidence: number;
  evidence: FailureEvidence[];
}

export interface WorkerNode {
  id: string;
  name: string;
  host: string;
  port: number;
  carlaVersion: string;
  scenarioRunnerVersion: string;
  status: "Online" | "Busy" | "Offline";
  capacity: number;
  activeRuns: number;
  lastHeartbeat: string;
}

export interface OracleRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  threshold: number;
  unit: string;
}

export interface OverviewData {
  totalScenarios: number;
  activeCampaigns: number;
  passRate: number;
  failureClusters: number;
  weeklyRuns: number[];
  weeklyLabels: string[];
  recentActivity: {
    id: string;
    title: string;
    detail: string;
    time: string;
    type: "success" | "warning" | "info";
  }[];
}

export interface CreateScenarioInput {
  name: string;
  description: string;
  map: string;
  category: string;
  severity: Scenario["severity"];
  weather: string;
}

export interface CreateCampaignInput {
  name: string;
  description: string;
  scenarioIds: string[];
  strategy: string;
}

export interface ScenarioFilters {
  query?: string;
  status?: string;
}

export interface AutoScenarioApi {
  getOverview(): Promise<OverviewData>;
  listScenarios(filters?: ScenarioFilters): Promise<Scenario[]>;
  createScenario(input: CreateScenarioInput): Promise<Scenario>;
  listCampaigns(): Promise<Campaign[]>;
  createCampaign(input: CreateCampaignInput): Promise<Campaign>;
  listFailures(): Promise<FailureCluster[]>;
  confirmFailureCluster(id: string): Promise<FailureCluster>;
  listWorkers(): Promise<WorkerNode[]>;
  listOracleRules(): Promise<OracleRule[]>;
  saveOracleRules(rules: OracleRule[]): Promise<OracleRule[]>;
}
