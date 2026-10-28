export type ScenarioStatus = "Active" | "Approved" | "In review" | "Draft" | "Archived";
export type CampaignStatus =
  "Running" | "Queued" | "Completed" | "Draft" | "Needs review" | "Failed" | "Cancelled";
export type RunVerdict = "PASS" | "FAIL" | "TIMEOUT" | "ERROR";
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
  | "backend-data"
  | "coverage"
  | "worker-protocol"
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
  routeDescription?: string;
  egoVehicle?: string;
  trafficDensity?: "Low" | "Medium" | "High";
  pedestrianCount?: number;
  obstacleCount?: number;
  triggerCondition?: string;
  actions?: string;
  sourceFileName?: string;
  executionMode?: "CARLA actors" | "OpenSCENARIO source";
  trafficVehicle?: string;
  trafficVehicleCount?: number;
  pedestrianBlueprint?: string;
  obstacleBlueprint?: string;
  executionDurationSeconds?: number;
  speedLimitOffsetPercent?: number;
}

export interface ScenarioVersionRecord {
  version: string;
  savedAt: string;
  note: string;
  hash: string;
  status: ScenarioStatus;
}

export interface ScenarioRun {
  id: string;
  campaignId: string;
  scenarioId: string;
  scenarioName: string;
  scenarioVersion: string;
  state: "Queued" | "Assigned" | "Running" | "Passed" | "Failed" | "Cancelled" | "Timed Out";
  progress: number;
  verdict?: RunVerdict;
  startedAt?: string;
  durationSeconds?: number;
  workerId?: string;
  retryOf?: string;
  repetition?: number;
  sutVersion?: string;
  agent?: "Behavior Agent" | "Autopilot";
  randomSeed?: number;
  oracleProfile?: string;
  artifacts: string[];
  evidence: FailureEvidence[];
}

export interface AuditEvent {
  id: string;
  time: string;
  actor: string;
  action: string;
  target: string;
  result: "Success" | "Rejected" | "Info";
}

export interface CarlaIntegrationConfig {
  host: string;
  rpcPort: number;
  streamingPort: number;
  carlaVersion: string;
  scenarioRunnerPath: string;
  qualityLevel: "Low";
  validated: boolean;
  active: boolean;
  connectionStatus: "Not tested" | "Ready" | "Connected" | "Failed";
  updatedAt: string;
}

export interface AnalyticsPreferences {
  similarityWarning: number;
  similarityBlock: number;
  featureWeights: { map: number; category: number; weather: number; severity: number; actors: number };
  retentionDays: number;
  reportDays: string;
  includeDrafts: boolean;
  group: string;
  weeklyEmail: boolean;
}

export interface OracleProfileState {
  version: number;
  active: boolean;
  validated: boolean;
  updatedAt: string;
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
  sutName?: string;
  sutVersion?: string;
  agent?: "Behavior Agent" | "Autopilot";
  randomSeed?: number;
  repetitions?: number;
  timeoutSeconds?: number;
  oracleProfile?: string;
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
  sourceRunId?: string;
  reviewedBy?: string;
  reviewerNote?: string;
  originalLabel?: string;
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
  routeDescription: string;
  egoVehicle: string;
  trafficDensity: "Low" | "Medium" | "High";
  pedestrianCount: number;
  obstacleCount: number;
  triggerCondition: string;
  actions: string;
  executionMode: "CARLA actors" | "OpenSCENARIO source";
  trafficVehicle: string;
  trafficVehicleCount: number;
  pedestrianBlueprint: string;
  obstacleBlueprint: string;
  executionDurationSeconds: number;
  speedLimitOffsetPercent: number;
}

export interface CreateCampaignInput {
  name: string;
  description: string;
  scenarioIds: string[];
  strategy: string;
  sutName?: string;
  sutVersion?: string;
  agent?: "Behavior Agent" | "Autopilot";
  randomSeed?: number;
  repetitions?: number;
  timeoutSeconds?: number;
  oracleProfile?: string;
}

export interface ScenarioFilters {
  query?: string;
  status?: string;
}

export interface AutoScenarioApi {
  backendRequest<T>(path: string, init?: RequestInit): Promise<T>;
  backendDownload(path: string, fileName: string): Promise<void>;
  backendMedia(path: string): Promise<Blob>;
  backendRefreshSession(): Promise<void>;
  getOverview(): Promise<OverviewData>;
  getCarlaIntegration(): Promise<CarlaIntegrationConfig>;
  saveCarlaIntegration(config: CarlaIntegrationConfig): Promise<CarlaIntegrationConfig>;
  testCarlaIntegration(): Promise<CarlaIntegrationConfig>;
  getAnalyticsPreferences(): Promise<AnalyticsPreferences>;
  saveAnalyticsPreferences(preferences: AnalyticsPreferences): Promise<AnalyticsPreferences>;
  listAuditEvents(): Promise<AuditEvent[]>;
  listScenarios(filters?: ScenarioFilters): Promise<Scenario[]>;
  createScenario(input: CreateScenarioInput): Promise<Scenario>;
  persistImportedScenario(scenario: Scenario, sourceContent: string): Promise<Scenario>;
  updateScenario(id: string, changes: Partial<Scenario>): Promise<Scenario>;
  cloneScenario(id: string): Promise<Scenario>;
  updateScenarioStatus(id: string, status: ScenarioStatus, note?: string): Promise<Scenario>;
  listScenarioVersions(id: string): Promise<ScenarioVersionRecord[]>;
  listCampaigns(): Promise<Campaign[]>;
  createCampaign(input: CreateCampaignInput): Promise<Campaign>;
  updateCampaign(id: string, changes: Partial<Campaign>): Promise<Campaign>;
  getCampaignRanking(id: string): Promise<Record<string, unknown> | null>;
  saveCampaignRanking(id: string, ranking: Record<string, unknown>): Promise<void>;
  updateScenarioMetrics(id: string, changes: Pick<Scenario, "runCount" | "passRate" | "lastRun">): Promise<Scenario>;
  listRuns(): Promise<ScenarioRun[]>;
  downloadRunArtifact(runId: string, fileName: string): Promise<void>;
  queueCampaignRuns(campaignId: string, scenarioIds?: string[], retryOf?: string): Promise<ScenarioRun[]>;
  cancelCampaignRuns(campaignId: string): Promise<ScenarioRun[]>;
  addFailureCluster(failure: FailureCluster): Promise<FailureCluster>;
  listFailures(): Promise<FailureCluster[]>;
  confirmFailureCluster(id: string, changes?: Partial<FailureCluster>): Promise<FailureCluster>;
  listWorkers(): Promise<WorkerNode[]>;
  saveWorkers(workers: WorkerNode[]): Promise<WorkerNode[]>;
  listOracleRules(): Promise<OracleRule[]>;
  saveOracleRules(rules: OracleRule[]): Promise<OracleRule[]>;
  getOracleProfileState(): Promise<OracleProfileState>;
  saveOracleProfileState(profile: OracleProfileState): Promise<OracleProfileState>;
}
