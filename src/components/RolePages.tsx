import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Icon } from "./Icon";
import { downloadCsv } from "../utils/download";
import { downloadTextFile } from "../utils/download";
import {
  appendAuditEvent,
  getAnalyticsPreferences,
  getRanking,
  listAuditEvents,
  saveAnalyticsPreferences,
} from "../services/workflowStore";
import { isAuthApiEnabled } from "../services/authConfig";
import { api, isMockMode } from "../services/api";
import type { AppDispatch, RootState } from "../app/store";
import { adminRoleChangeRequested, adminUsersRequested } from "../features/auth/authSlice";
import type {
  AppPage,
  AnalyticsPreferences,
  AuditEvent,
  Campaign,
  DemoUser,
  FailureCluster,
  Scenario,
  ScenarioRun,
  ScenarioStatus,
  UserRole,
  WorkerNode,
} from "../types";

interface RolePagesProps {
  page: AppPage;
  user: DemoUser;
  scenarios: Scenario[];
  campaigns: Campaign[];
  failures: FailureCluster[];
  runs: ScenarioRun[];
  workers: WorkerNode[];
  onNavigate: (page: AppPage) => void;
  onNotify: (message: string) => void;
  onScenarioStatus: (id: string, status: ScenarioStatus, note?: string) => Promise<boolean>;
  onScenarioUpdate: (id: string, changes: Partial<Scenario>) => Promise<boolean>;
  onImport: (scenario: Scenario, sourceContent: string) => Promise<Scenario>;
  onFailureConfirm: (failure: FailureCluster, changes?: Partial<FailureCluster>) => void;
  onScenarioReexecute: (failure: FailureCluster) => void;
  onCampaignStart: (id: string) => void;
  onCampaignCancel: (id: string) => void;
  onDownloadArtifact: (runId: string, fileName: string) => void;
  onUserUpdate: (user: DemoUser) => void;
  onLogout: () => void;
  initialScenarioId?: string;
  selectedCampaignId?: string;
  onOpenCampaign: (id: string) => void;
}

const roleNotes: Record<
  UserRole,
  {
    title: string;
    text: string;
    icon: "scenarios" | "play" | "shield" | "settings";
  }
> = {
  "Scenario Engineer": {
    title: "Build a stronger scenario library",
    text: "Create, import and compare reusable road situations. The system validates each configuration before it becomes ready for testing.",
    icon: "scenarios",
  },
  "Test Engineer": {
    title: "Turn scenarios into safety evidence",
    text: "Build risk-focused campaigns, monitor execution and inspect explainable test failures.",
    icon: "play",
  },
  "Test Reviewer": {
    title: "Review evidence with context",
    text: "Review execution evidence and confirm explainable failure labels.",
    icon: "shield",
  },
  Administrator: {
    title: "Keep the simulation workspace healthy",
    text: "Manage access, worker capacity, safety rules and audit visibility for the team.",
    icon: "settings",
  },
};

export function RoleWelcome({
  role,
  onNavigate,
}: {
  role: UserRole;
  onNavigate: (page: AppPage) => void;
}) {
  const note = roleNotes[role];
  const cards: Record<
    UserRole,
    {
      title: string;
      detail: string;
      page: AppPage;
      icon:
        "scenarios" | "campaigns" | "priority" | "failures" | "users" | "nodes";
    }[]
  > = {
    "Scenario Engineer": [
      {
        title: "Scenario library",
        detail: "Search and maintain reusable cases",
        page: "scenarios",
        icon: "scenarios",
      },
      {
        title: "Import scenarios",
        detail: "Validate an OpenSCENARIO file",
        page: "import",
        icon: "campaigns",
      },
      {
        title: "Compare versions",
        detail: "Review risk and coverage changes",
        page: "compare",
        icon: "priority",
      },
    ],
    "Test Engineer": [
      {
        title: "Campaigns",
        detail: "Prepare and monitor test suites",
        page: "campaigns",
        icon: "campaigns",
      },
      {
        title: "Prioritization",
        detail: "Order tests by risk and history",
        page: "priority",
        icon: "priority",
      },
      {
        title: "Execution queue",
        detail: "Start and follow queued runs",
        page: "execution",
        icon: "failures",
      },
    ],
    "Test Reviewer": [
      {
        title: "Review queue",
        detail: "Review failure evidence and root causes",
        page: "review",
        icon: "failures",
      },
      {
        title: "Failure insights",
        detail: "Inspect evidence and confidence",
        page: "failures",
        icon: "priority",
      },
      {
        title: "Campaign reports",
        detail: "Check results before sign-off",
        page: "report",
        icon: "campaigns",
      },
    ],
    Administrator: [
      {
        title: "User management",
        detail: "Review role assignments",
        page: "users",
        icon: "users",
      },
      {
        title: "Simulation nodes",
        detail: "Monitor CARLA capacity",
        page: "nodes",
        icon: "nodes",
      },
      {
        title: "Safety configuration",
        detail: "Maintain oracle thresholds",
        page: "oracles",
        icon: "failures",
      },
    ],
  };
  return (
    <section className="role-welcome">
      <div className="role-welcome-copy">
        <span className="role-welcome-icon">
          <Icon name={note.icon} size={19} />
        </span>
        <span className="section-kicker">
          YOUR {role.toUpperCase()} WORKSPACE
        </span>
        <h2>{note.title}</h2>
        <p>{note.text}</p>
      </div>
      <div className="role-quick-grid">
        {cards[role].map((card, index) => (
          <button
            key={card.page}
            className="role-quick-card"
            onClick={() => onNavigate(card.page)}
          >
            <span className={`role-quick-icon q-${index}`}>
              <Icon name={card.icon} size={17} />
            </span>
            <span>
              <b>{card.title}</b>
              <small>{card.detail}</small>
            </span>
            <Icon name="arrow-right" size={15} />
          </button>
        ))}
      </div>
    </section>
  );
}

export function RolePages(props: RolePagesProps) {
  const { page } = props;
  switch (page) {
    case "scenario-editor":
      return <ScenarioEditor {...props} />;
    case "import":
      return <ImportScenarios {...props} />;
    case "compare":
      return <ScenarioCompare {...props} />;
    case "clusters":
      return <ScenarioClusters {...props} />;
    case "execution":
      return <ExecutionQueue {...props} />;
    case "run-detail":
      return <RunDetails {...props} />;
    case "review":
      return <ReviewQueue {...props} />;
    case "report":
      return <CampaignReport {...props} />;
    case "users":
      return <UserManagement {...props} />;
    case "analytics":
      return <AnalyticsSettings {...props} />;
    case "audit":
      return <AuditLog {...props} />;
    case "profile":
      return <Profile {...props} />;
    default:
      return null;
  }
}

function ScenarioEditor({
  scenarios,
  onScenarioStatus,
  onScenarioUpdate,
  initialScenarioId,
}: RolePagesProps) {
  const [id, setId] = useState(initialScenarioId ?? scenarios[0]?.id ?? "");
  const [preview, setPreview] = useState<Scenario | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [editingChanged, setEditingChanged] = useState(false);
  const selected = scenarios.find((scenario) => scenario.id === id);
  const selectedReady = (selected?.status === "Active" || selected?.status === "Approved") && !editingChanged;
  function changesFromForm(form: HTMLFormElement): Partial<Scenario> {
    const data = new FormData(form);
    const field = (name: string) => String(data.get(name) ?? "").trim();
    return {
      name: field("name"),
      description: field("description"),
      map: field("map"),
      weather: field("weather"),
      category: field("category"),
      routeDescription: field("routeDescription"),
      egoVehicle: field("egoVehicle"),
      trafficDensity: field("trafficDensity") as Scenario["trafficDensity"],
      pedestrianCount: data.get("pedestrianCount") === "" ? Number.NaN : Number(data.get("pedestrianCount")),
      obstacleCount: data.get("obstacleCount") === "" ? Number.NaN : Number(data.get("obstacleCount")),
      triggerCondition: field("triggerCondition"),
      actions: field("actions"),
    };
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setValidationErrors([]);
    if (await onScenarioUpdate(selected.id, { ...changesFromForm(event.currentTarget), status: "Draft" })) {
      setEditingChanged(false);
    }
  }
  async function validateConfiguration(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!selected || !form) return;
    const changes = changesFromForm(form);
    const issues = getScenarioConfigurationIssues(changes);
    setValidationErrors(issues);
    if (issues.length) return;
    setValidating(true);
    try {
      const saved = await onScenarioUpdate(selected.id, { ...changes, status: "Draft" });
      if (!saved) return;
      await onScenarioStatus(selected.id, "Active", "System configuration validation passed; ready for testing.");
      setEditingChanged(false);
    } finally {
      setValidating(false);
    }
  }
  return (
    <div className="role-page-stack">
      <section className="card editor-toolbar">
        <div>
          <small className="section-kicker">SCENARIO AUTHORING</small>
          <h3>Scenario editor</h3>
          <p>Configure the scenario, then let the system validate it for testing.</p>
        </div>
        <label className="field-inline">
          Editing
          <select value={id} onChange={(event) => { setId(event.target.value); setEditingChanged(false); setValidationErrors([]); }}>
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.id} · {scenario.name}
              </option>
            ))}
          </select>
        </label>
      </section>
      {!selected ? (
        <EmptyPanel text="Create a scenario first to open the editor." />
      ) : (
        <form className="card editor-form" key={id} onSubmit={save} onChange={() => { setEditingChanged(true); setValidationErrors([]); }}>
          <div className="editor-form-main">
            <div className="editor-form-heading">
              <span className="editor-step">01</span>
              <div>
                <h3>Scenario definition</h3>
                <p>Describe the road context and environment variables.</p>
              </div>
              <span className={selectedReady ? "badge approved" : "badge draft"}>
                {selectedReady ? "READY FOR TESTING" : "DRAFT EDIT"}
              </span>
            </div>
            <label>
              Scenario name
              <input
                name="name"
                defaultValue={selected.name}
                required
                maxLength={255}
              />
            </label>
            <label>
              Scenario description
              <textarea
                name="description"
                rows={5}
                defaultValue={selected.description}
              />
            </label>
            <div className="form-row">
              <label>
                CARLA map
                <select name="map" defaultValue={selected.map}>
                  {[
                    "Town01",
                    "Town02",
                    "Town03",
                    "Town04",
                    "Town05",
                    "Town06",
                    "Town07",
                    "Town10HD",
                  ].map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Scenario category
                <select name="category" defaultValue={selected.category}>
                  {["Urban", "Highway", "Intersection", "Rural", "Parking"].map(
                    (item) => (
                      <option key={item}>{item}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <label>
              Weather preset
              <select name="weather" defaultValue={selected.weather}>
                {[
                  "Clear noon",
                  "Clear morning",
                  "Sunset",
                  "Overcast",
                  "Light rain",
                  "Heavy rain",
                  "Fog",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Route description
                <input name="routeDescription" defaultValue={selected.routeDescription ?? "Start → junction → goal"} maxLength={500} />
              </label>
              <label>
                Ego vehicle
                <select name="egoVehicle" defaultValue={selected.egoVehicle ?? "vehicle.tesla.model3"}>
                  {["vehicle.tesla.model3", "vehicle.lincoln.mkz_2020", "vehicle.mercedes.coupe", "vehicle.audi.tt"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Traffic density
                <select name="trafficDensity" defaultValue={selected.trafficDensity ?? "Medium"}>
                  {["Low", "Medium", "High"].map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>
                Pedestrians / obstacles
                <span className="form-row">
                  <input name="pedestrianCount" type="number" min="0" max="100" defaultValue={selected.pedestrianCount ?? 1} aria-label="Pedestrians" />
                  <input name="obstacleCount" type="number" min="0" max="100" defaultValue={selected.obstacleCount ?? 0} aria-label="Obstacles" />
                </span>
              </label>
            </div>
            <div className="form-row">
              <label>
                Trigger condition
                <input name="triggerCondition" defaultValue={selected.triggerCondition ?? "Ego reaches start waypoint"} maxLength={300} />
              </label>
              <label>
                Scenario action
                <input name="actions" defaultValue={selected.actions ?? "Actor enters ego lane"} maxLength={300} />
              </label>
            </div>
            <div className="editor-form-actions">
              <button
                className="btn btn-light"
                type="button"
                onClick={(event) => {
                  const form = event.currentTarget.form;
                  if (!form) return;
                  setPreview({
                    ...selected,
                    ...changesFromForm(form),
                  });
                }}
              >
                Preview definition
              </button>
              <button className="btn btn-primary" type="submit">
                <Icon name="check" size={15} />
                Save draft
              </button>
              <button
                className="btn btn-light"
                type="button"
                disabled={validating}
                onClick={(event) => void validateConfiguration(event)}
              >
                <Icon name="check" size={15} />
                {validating ? "Validating…" : "Validate configuration"}
              </button>
            </div>
          </div>
          <aside className="editor-aside">
            <small className="section-kicker">VALIDATION CHECKLIST</small>
            {[
              ["Road context", "Map, route and category are defined"],
              ["Environment", "Weather, vehicle and traffic are configured"],
              ["Scenario behavior", "Trigger and action are defined"],
            ].map(([title, text]) => (
              <div className="check-row" key={title}>
                <span className={selectedReady ? "check-on" : "check-wait"}>
                  <Icon name={selectedReady ? "check" : "clock"} size={13} />
                </span>
                <span>
                  <b>{title}</b>
                  <small>{text}</small>
                </span>
              </div>
            ))}
            <div className="editor-risk">
              <Icon name="shield" size={16} />
              <span>
                <b>{selectedReady ? "Ready for testing" : "System validation"}</b>
                <small>Valid configurations become ready automatically. No manual scenario approval is needed.</small>
              </span>
            </div>
            {validationErrors.length > 0 && (
              <div className="scenario-validation-errors" role="alert">
                <b>Configuration needs changes</b>
                <ul>{validationErrors.map((issue) => <li key={issue}>{issue}</li>)}</ul>
              </div>
            )}
            {validationErrors.length === 0 && selectedReady && (
              <p className="scenario-validation-success">This version passed system validation.</p>
            )}
          </aside>
        </form>
      )}
      {preview && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
          <section className="modal review-detail-modal" role="dialog" aria-modal="true" aria-labelledby="scenario-preview-title">
            <div className="modal-head">
              <div>
                <small className="section-kicker">UNSAVED SCENARIO PREVIEW · {preview.id}</small>
                <h2 id="scenario-preview-title">{preview.name}</h2>
                <p>{preview.description || "No description provided."}</p>
              </div>
              <button className="icon-button" type="button" aria-label="Close scenario preview" onClick={() => setPreview(null)}><Icon name="close" size={18} /></button>
            </div>
            <div className="review-detail-grid">
              {[
                ["Map / route", `${preview.map} · ${preview.routeDescription ?? "—"}`],
                ["Category / weather", `${preview.category} · ${preview.weather}`],
                ["Ego vehicle", preview.egoVehicle ?? "—"],
                ["Traffic density", preview.trafficDensity ?? "—"],
                ["Pedestrians / obstacles", `${preview.pedestrianCount ?? 0} / ${preview.obstacleCount ?? 0}`],
                ["Trigger", preview.triggerCondition ?? "—"],
                ["Scenario action", preview.actions ?? "—"],
              ].map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}
            </div>
            <div className="modal-actions">
              <span className="badge draft">Preview only · not saved</span>
              <button className="btn btn-primary" type="button" onClick={() => setPreview(null)}>Close preview</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function getScenarioConfigurationIssues(scenario: Partial<Scenario>) {
  const requiredFields: [string, string | undefined][] = [
    ["Scenario name", scenario.name],
    ["CARLA map", scenario.map],
    ["Scenario category", scenario.category],
    ["Weather preset", scenario.weather],
    ["Route description", scenario.routeDescription],
    ["Ego vehicle", scenario.egoVehicle],
    ["Traffic density", scenario.trafficDensity],
    ["Trigger condition", scenario.triggerCondition],
    ["Scenario action", scenario.actions],
  ];
  const issues = requiredFields
    .filter(([, value]) => !value?.trim())
    .map(([label]) => `${label} is required.`);
  for (const [label, value] of [
    ["Pedestrian count", scenario.pedestrianCount],
    ["Obstacle count", scenario.obstacleCount],
  ] as const) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
      issues.push(`${label} must be a whole number between 0 and 100.`);
    }
  }
  return issues;
}

function ImportScenarios({
  scenarios,
  onImport,
  onNotify,
  onNavigate,
}: RolePagesProps) {
  const [file, setFile] = useState<File | null>(null);
  const acceptFile = (candidate?: File) => {
    if (!candidate) return;
    if (!/\.(xosc|osc)$/i.test(candidate.name)) {
      onNotify("Choose an OpenSCENARIO .xosc or .osc file.");
      return;
    }
    if (candidate.size > 10 * 1024 * 1024) {
      onNotify("The import limit is 10 MB.");
      return;
    }
    setFile(candidate);
  };
  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  };
  const normalizedFileName = file?.name
    .replace(/\.(xosc|osc)$/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  const duplicate = Boolean(
    normalizedFileName &&
    scenarios.some(
      (scenario) =>
        scenario.name.replace(/[^a-z0-9]/gi, "").toLowerCase() ===
        normalizedFileName,
    ),
  );
  async function importFile() {
    if (!file) return;
    if (duplicate) {
      onNotify("A scenario with this name is already in the library.");
      return;
    }
    let contents: string;
    try {
      contents = await file.text();
    } catch {
      onNotify("The selected scenario file could not be read.");
      return;
    }
    const parsed = new DOMParser().parseFromString(contents, "application/xml");
    const root = parsed.documentElement;
    if (
      parsed.getElementsByTagName("parsererror").length > 0 ||
      root.localName !== "OpenSCENARIO" ||
      parsed.getElementsByTagName("Storyboard").length === 0
    ) {
      onNotify("Import rejected: expected valid OpenSCENARIO XML with a Storyboard. No scenario was created.");
      return;
    }
    const name = file.name.replace(/\.(xosc|osc)$/i, "").replace(/[_-]+/g, " ");
    const logicFile = parsed.getElementsByTagName("LogicFile")[0]?.getAttribute("filepath") ?? "";
    const mapMatch = logicFile.match(/Town\d+|Town10HD/i);
    const actorCount = parsed.getElementsByTagName("ScenarioObject").length;
    const scenario: Scenario = {
      id: "SCN-IMPORT",
      name,
      description: `Imported from ${file.name}. Configure and validate the scenario before testing.`,
      map: mapMatch?.[0] ?? "Town05",
      category: "Urban",
      severity: "Medium",
      status: "Draft",
      version: "v0.1",
      weather: "Clear noon",
      actors: Math.max(1, actorCount + 1),
      runCount: 0,
      passRate: 0,
      lastRun: "Not run",
      owner: "Current user",
      tags: ["imported"],
      priorityScore: 52,
      routeDescription: "Imported route configuration",
      egoVehicle: "Imported from OpenSCENARIO",
      sourceFileName: file.name,
    };
    try {
      const saved = await onImport(scenario, contents);
      setFile(null);
      onNotify(`${saved.id} was imported as a draft from ${file.name}.`);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "Could not save the imported scenario.");
    }
  }
  return (
    <div className="role-page-stack">
      <section className="card import-intro">
        <div className="import-icon">
          <Icon name="upload" size={21} />
        </div>
        <div>
          <small className="section-kicker">SCENARIO LIBRARY · IMPORT</small>
          <h3>Bring an OpenSCENARIO file into your library</h3>
          <p>
            Upload a .xosc or .osc file. It starts as a draft; configure it in
            the editor and system validation will make it ready for testing.
          </p>
        </div>
        <span className="badge approved">DRAFT FIRST</span>
      </section>
      <label
        className="import-drop"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const dropped = event.dataTransfer.files[0];
          acceptFile(dropped);
        }}
      >
        <input type="file" accept=".xosc,.osc" onChange={onFile} />
        <span className="import-cloud">
          <Icon name="upload" size={22} />
        </span>
        <b>{file ? file.name : "Drop a scenario file here"}</b>
        <small>
          {file
            ? `${(file.size / 1024).toFixed(1)} KB · Ready for XML validation`
            : "or choose a file from your computer · .xosc, .osc · up to 10 MB"}
        </small>
        <span className="btn btn-light">Choose file</span>
      </label>
      {duplicate && file && (
        <div className="import-warning">
          <span>
            <Icon name="warning" size={16} />
          </span>
          <div>
            <b>Possible duplicate detected</b>
            <small>
              {file.name} matches an existing scenario name. Compare the
              existing definition before importing.
            </small>
          </div>
          <button className="link-button" onClick={() => onNavigate("compare")}>
            Compare scenarios <Icon name="arrow-right" size={13} />
          </button>
        </div>
      )}
      <div className="import-grid">
        <div className="card import-requirements">
          <small className="section-kicker">IMPORT CHECKS</small>
          <h3>What happens next?</h3>
          {[
            ["File type", "OpenSCENARIO XML format"],
            ["XML structure", "OpenSCENARIO root and Storyboard are present"],
            ["Name conflict check", "Compare normalized names in the library"],
            ["Next step", "Configure and validate before testing"],
          ].map(([label, text], index) => (
            <div className="check-row" key={label}>
              <span className="check-on">
                <Icon name="check" size={13} />
              </span>
              <span>
                <b>{label}</b>
                <small>{text}</small>
              </span>
              <small>{index === 0 && file ? "READY" : isMockMode ? "MOCK" : "API"}</small>
            </div>
          ))}
        </div>
        <div className="card import-side">
          <Icon name="shield" size={18} />
          <h3>Safe by default</h3>
          <p>
            In API mode, XML is validated and stored against the scenario
            version. A configured worker runs that saved artifact.
          </p>
          <button
            className="link-button"
            onClick={() =>
              onNotify(
                isMockMode
                  ? "Mock mode keeps the imported file in this browser only."
                  : "The .NET API validates XML structure, enforces upload limits and stores the source artifact.",
              )
            }
          >
            View integration notes <Icon name="arrow-right" size={13} />
          </button>
        </div>
      </div>
      <div className="import-footer">
        <span>Accepted formats: .xosc, .osc</span>
        <button
          className="btn btn-primary"
          disabled={!file || duplicate}
          onClick={importFile}
        >
          <Icon name="check" size={15} />
          Validate and import
        </button>
      </div>
    </div>
  );
}

function ScenarioCompare({ scenarios }: RolePagesProps) {
  const [preferences, setPreferences] = useState(getAnalyticsPreferences);
  useEffect(() => {
    if (isMockMode) return;
    let active = true;
    void api.getAnalyticsPreferences().then((value) => {
      if (!active) return;
      setPreferences(value);
      saveAnalyticsPreferences(value);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const [leftId, setLeftId] = useState(scenarios[0]?.id ?? "");
  const [rightId, setRightId] = useState(
    scenarios[1]?.id ?? scenarios[0]?.id ?? "",
  );
  const left = scenarios.find((scenario) => scenario.id === leftId);
  const right = scenarios.find((scenario) => scenario.id === rightId);
  const comparableFeatures = left && right ? [
    ["category", left.category === right.category ? 1 : 0],
    ["map", left.map === right.map ? 1 : 0],
    ["weather", left.weather === right.weather ? 1 : 0],
    ["severity", left.severity === right.severity ? 1 : 0],
    ["actors", 1 - Math.min(1, Math.abs(left.actors - right.actors) / Math.max(left.actors, right.actors, 1))],
  ] as [keyof AnalyticsPreferences["featureWeights"], number][] : [];
  const totalWeight = comparableFeatures.reduce((sum, [feature]) => sum + preferences.featureWeights[feature], 0);
  const similarity = totalWeight > 0
    ? comparableFeatures.reduce((sum, [feature, score]) => sum + score * preferences.featureWeights[feature], 0) / totalWeight
    : undefined;
  const similarityLabel = similarity === undefined
    ? "No comparison weight"
    : similarity >= preferences.similarityBlock
      ? "Possible duplicate"
      : similarity >= preferences.similarityWarning
        ? "Review match"
        : "Distinct";
  const rows: [string, string, string][] =
    left && right
      ? [
          ["Scenario type", left.category, right.category],
          ["CARLA map", left.map, right.map],
          ["Weather", left.weather, right.weather],
          ["Risk severity", left.severity, right.severity],
          ["Actors", `${left.actors} entities`, `${right.actors} entities`],
          [
            "Pass rate",
            `${left.passRate.toFixed(1)}%`,
            `${right.passRate.toFixed(1)}%`,
          ],
          [
            "Priority score",
            `${left.priorityScore}/100`,
            `${right.priorityScore}/100`,
          ],
        ]
      : [];
  return (
    <div className="role-page-stack">
      <section className="card compare-toolbar">
        <div>
          <small className="section-kicker">SCENARIO ANALYSIS</small>
          <h3>Compare scenario definitions</h3>
          <p>Compare risk, execution history and environment side by side.</p>
        </div>
        <button
          className="btn btn-light"
          disabled={!left || !right}
          onClick={() => left && right && downloadCsv("scenario-comparison.csv", [
            ["Feature", left.id, right.id],
            ...rows,
            ["Gower similarity", `${((similarity ?? 0) * 100).toFixed(1)}%`, `${((similarity ?? 0) * 100).toFixed(1)}%`],
          ])}
        >
          <Icon name="download" size={15} />
          Export comparison
        </button>
      </section>
      <div className="compare-selectors">
        <label className="card compare-select compare-a">
          <span>SCENARIO A</span>
          <select
            value={leftId}
            onChange={(event) => setLeftId(event.target.value)}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.id} · {scenario.name}
              </option>
            ))}
          </select>
          {left && (
            <small>
              <Badge value={left.status} /> {left.version} · owner {left.owner}
            </small>
          )}
        </label>
        <div className="compare-vs">VS</div>
        <label className="card compare-select compare-b">
          <span>SCENARIO B</span>
          <select
            value={rightId}
            onChange={(event) => setRightId(event.target.value)}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>
                {scenario.id} · {scenario.name}
              </option>
            ))}
          </select>
          {right && (
            <small>
              <Badge value={right.status} /> {right.version} · owner{" "}
              {right.owner}
            </small>
          )}
        </label>
      </div>
      <section className="card compare-table">
        <div className="compare-table-head">
          <div>COMPARISON</div>
          <b>{left?.id ?? "—"}</b>
          <b>{right?.id ?? "—"}</b>
        </div>
        {rows.map(([label, a, b]) => (
          <div className="compare-row" key={label}>
            <span>{label}</span>
            <b className={a !== b ? "compare-different" : ""}>{a}</b>
            <b className={a !== b ? "compare-different" : ""}>{b}</b>
          </div>
        ))}
      </section>
      {similarity !== undefined && (
        <section className="card compare-similarity">
          <div>
            <small className="section-kicker">GOWER SIMILARITY · CONFIGURATION FEATURES</small>
            <h3>{(similarity * 100).toFixed(1)}% similar</h3>
            <p>Mixed categorical and numeric values are normalized; the score is calculated from the fields shown in this comparison.</p>
          </div>
          <Badge value={similarityLabel} />
        </section>
      )}
    </div>
  );
}

function ScenarioClusters({ scenarios, onNavigate, onNotify }: RolePagesProps) {
  const groups = useMemo(
    () =>
      ["Urban", "Highway", "Intersection", "Rural"]
        .map((category) => ({
          category,
          items: scenarios.filter((scenario) => scenario.category === category),
        }))
        .filter((group) => group.items.length),
    [scenarios],
  );
  return (
    <div className="role-page-stack">
      <section className="card cluster-explainer">
        <span className="cluster-explainer-icon">
          <Icon name="spark" size={18} />
        </span>
        <div>
          <small className="section-kicker">LIBRARY EXPLORER</small>
          <h3>Scenario clusters</h3>
          <p>
            Browse related cases grouped by road context. Similarity is a mock
            estimate based on category, map and tags.
          </p>
        </div>
        <div className="cluster-stat">
          <b>{groups.length}</b>
          <small>active groups</small>
        </div>
      </section>
      <div className="scenario-cluster-grid">
        {groups.map((group, index) => (
          <section className="card scenario-cluster" key={group.category}>
            <div className={`cluster-art cluster-art-${index}`}>
              <span>
                <Icon
                  name={
                    group.category === "Highway"
                      ? "route"
                      : group.category === "Intersection"
                        ? "map"
                        : "car"
                  }
                  size={19}
                />
              </span>
              <small>{group.items.length} CASES</small>
            </div>
            <div className="scenario-cluster-body">
              <div>
                <h3>{group.category} scenarios</h3>
                <small>
                  {
                    group.items.filter((item) => item.status === "Active" || item.status === "Approved")
                      .length
                  }{" "}
                  active ·{" "}
                  {
                    group.items.filter((item) => item.status !== "Active" && item.status !== "Approved")
                      .length
                  }{" "}
                  need attention
                </small>
              </div>
              <div className="cluster-chips">
                {group.items.slice(0, 3).map((item) => (
                  <span key={item.id}>{item.id}</span>
                ))}
                {group.items.length > 3 && (
                  <span>+{group.items.length - 3}</span>
                )}
              </div>
              <div className="cluster-mini-list">
                {group.items.slice(0, 2).map((item) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      onNotify(
                        `${item.id} · ${item.name} · ${Math.min(98, item.priorityScore)}% similarity`,
                      )
                    }
                  >
                    <span>
                      <b>{item.name}</b>
                      <small>
                        {item.map} · {item.weather}
                      </small>
                    </span>
                    <Icon name="arrow-right" size={14} />
                  </button>
                ))}
              </div>
              <button
                className="link-button"
                onClick={() => onNavigate("scenarios")}
              >
                Open in scenario library <Icon name="arrow-right" size={13} />
              </button>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ExecutionQueue({
  campaigns,
  workers,
  runs,
  onNavigate,
  onOpenCampaign,
  onCampaignStart,
  onCampaignCancel,
}: RolePagesProps) {
  const running = runs.filter((run) => run.state === "Running").length;
  const queued = runs.filter((run) => run.state === "Queued" || run.state === "Assigned").length;
  const totalCapacity = workers.reduce(
    (sum, worker) => sum + worker.capacity,
    0,
  );
  const capacity = totalCapacity
    ? Math.round(
        (workers.reduce((sum, worker) => sum + worker.activeRuns, 0) /
          totalCapacity) *
          100,
      )
    : 0;
  return (
    <div className="role-page-stack">
      <div className="metric-grid">
        <MiniMetric
          label="RUNNING NOW"
          value={String(running).padStart(2, "0")}
          icon="activity"
          tone="green"
        />
        <MiniMetric
          label="WAITING IN QUEUE"
          value={String(queued).padStart(2, "0")}
          icon="clock"
          tone="violet"
        />
        <MiniMetric
          label="COMPLETED TODAY"
          value={String(runs.filter((run) => run.state === "Passed" || run.state === "Failed").length)}
          icon="check"
          tone="blue"
        />
        <MiniMetric
          label="WORKER CAPACITY"
          value={`${capacity}%`}
          icon="nodes"
          tone="orange"
        />
      </div>
      <section className="card queue-card">
        <div className="section-head">
          <div>
            <small className="section-kicker">CAMPAIGN EXECUTION</small>
            <h3>Execution queue</h3>
            <p>
              Start queued campaigns and open run details to inspect progress.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => onNavigate("campaigns")}
          >
            <Icon name="plus" size={15} />
            Build campaign
          </button>
        </div>
        <div className="role-table-wrap">
          <table className="role-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Scenarios</th>
                <th>Progress</th>
                <th>Est. duration</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <button
                      className="table-primary-link"
                      onClick={() => onOpenCampaign(campaign.id)}
                    >
                      <b>{campaign.name}</b>
                      <small>
                        {campaign.id} · {campaign.owner}
                      </small>
                    </button>
                  </td>
                  <td>
                    <Badge value={campaign.status} />
                  </td>
                  <td>{campaign.scenarioIds.length} scenarios</td>
                  <td>
                    <div className="table-progress">
                      <span>
                        <i style={{ width: `${campaign.progress}%` }} />
                      </span>
                      <small>{campaign.progress}%</small>
                    </div>
                  </td>
                  <td>{campaign.estimatedDuration}</td>
                  <td className="table-actions">
                    {campaign.status === "Queued" ||
                    campaign.status === "Draft" ? (
                      <button
                        className="btn btn-primary btn-xs"
                        onClick={() => onCampaignStart(campaign.id)}
                      >
                        Start run
                      </button>
                    ) : campaign.status === "Running" ? (
                      <button
                        className="btn btn-light btn-xs"
                        onClick={() => onCampaignCancel(campaign.id)}
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        className="link-button"
                        onClick={() => onNavigate("report")}
                      >
                        View report <Icon name="arrow-right" size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="queue-foot">
          <span>
            <i /> {isMockMode ? "Queue service simulated locally" : "PostgreSQL queue · local CARLA worker · Low quality"}
          </span>
          <button
            className="link-button"
            onClick={() => onNavigate("run-detail")}
          >
            View worker capacity <Icon name="arrow-right" size={13} />
          </button>
        </div>
      </section>
    </div>
  );
}

function RunDetails({
  campaigns,
  scenarios,
  runs,
  workers,
  user,
  selectedCampaignId,
  onDownloadArtifact,
  onNavigate,
}: RolePagesProps) {
  const campaign =
    campaigns.find((item) => item.id === selectedCampaignId) ??
    campaigns.find((item) => item.status === "Running") ??
    campaigns[0];
  const runScenarios = campaign
    ? scenarios.filter((scenario) => campaign.scenarioIds.includes(scenario.id))
    : [];
  const campaignRuns = campaign ? runs.filter((run) => run.campaignId === campaign.id) : [];
  const completedRuns = campaignRuns.filter((run) => run.verdict === "PASS" || run.verdict === "FAIL" || run.verdict === "TIMEOUT");
  const passedRuns = campaignRuns.filter((run) => run.verdict === "PASS").length;
  const activeWorker = workers.find((worker) => worker.id === campaignRuns.at(-1)?.workerId);
  return (
    <div className="role-page-stack">
      <section className="run-detail-hero">
        <div>
          <button
            className="back-link"
            onClick={() =>
              onNavigate(user.role === "Test Reviewer" ? "review" : "execution")
            }
          >
            <Icon name="arrow-right" size={13} />
            {user.role === "Test Reviewer"
              ? "Back to review queue"
              : "Back to execution queue"}
          </button>
          <small>RUN DETAILS · {campaignRuns.at(-1)?.id ?? "AWAITING FIRST EXECUTION"}</small>
          <h2>{campaign?.name ?? "No active campaign"}</h2>
          <p>
            {isMockMode ? "Local mock execution" : "CARLA / ScenarioRunner execution"} · {campaignRuns.length} run records · scenario versions retained at dispatch
          </p>
        </div>
        <Badge value={campaign?.status ?? "Queued"} />
      </section>
      <div className="metric-grid">
        <MiniMetric
          label="SCENARIOS"
          value={String(runScenarios.length || 0)}
          icon="scenarios"
          tone="violet"
        />
        <MiniMetric
          label="COMPLETED"
          value={String(
            completedRuns.length,
          )}
          icon="check"
          tone="green"
        />
        <MiniMetric
          label="PASS RATE"
          value={`${completedRuns.length ? Math.round((passedRuns / completedRuns.length) * 100) : 0}%`}
          icon="activity"
          tone="blue"
        />
        <MiniMetric
          label="FAILED RUNS"
          value={String(campaignRuns.filter((run) => run.verdict === "FAIL" || run.verdict === "TIMEOUT").length)}
          icon="warning"
          tone="orange"
        />
      </div>
      <div className="run-detail-grid">
        <section className="card run-timeline">
          <div className="section-head">
            <div>
              <small className="section-kicker">LIVE EXECUTION</small>
              <h3>Scenario run timeline</h3>
              <p>Per-scenario result and oracle summary.</p>
            </div>
            <button
              className="btn btn-light"
              disabled={!campaignRuns.length}
              onClick={() => downloadTextFile(`${campaign?.id ?? "campaign"}-run-logs.json`, JSON.stringify(campaignRuns, null, 2), "application/json")}
            >
              <Icon name="external" size={14} />
              Open logs
            </button>
          </div>
          {campaignRuns.length ? (
            campaignRuns.map((run, index) => (
              <div className="run-item run-item-detail" key={run.id}>
                <span className={`run-dot run-dot-${index % 3}`}>
                  {run.state === "Passed" ? (
                    <Icon name="check" size={12} />
                  ) : run.state === "Failed" ? (
                    <Icon name="warning" size={12} />
                  ) : (
                    <Icon name="clock" size={12} />
                  )}
                </span>
                <div>
                  <b>{run.scenarioName}</b>
                  <small>
                    {run.id} · {run.scenarioId} · {run.scenarioVersion} · repeat {run.repetition ?? 1} · {run.workerId ?? "Unassigned"}
                  </small>
                  {run.evidence.map((item, evidenceIndex) => <small className="run-evidence-line" key={`${item.rule}-${evidenceIndex}`}>{item.timestamp} · {item.rule}: {item.measured} / {item.threshold}</small>)}
                  <small className="run-evidence-line">Artifacts: {run.artifacts.length ? run.artifacts.join(", ") : "None"}</small>
                  {!isMockMode && run.artifacts.map((fileName) => (
                    <button className="link-button" key={fileName} onClick={() => onDownloadArtifact(run.id, fileName)}>
                      Download {fileName} <Icon name="download" size={12} />
                    </button>
                  ))}
                </div>
                <span className="run-duration">
                  {run.durationSeconds ? `${Math.floor(run.durationSeconds / 60)}m ${run.durationSeconds % 60}s` : `${run.progress}%`}
                </span>
                <Badge value={run.verdict ?? run.state} />
              </div>
            ))
          ) : (
            <EmptyPanel text={runScenarios.length ? "No execution records yet. Start the campaign from the execution queue." : "This campaign does not have linked scenarios."} />
          )}
        </section>
        <aside className="card run-context">
          <small className="section-kicker">EXECUTION CONTEXT</small>
          <h3>Environment</h3>
          {[
            ["Simulation node", activeWorker?.name ?? "No worker assigned"],
            ["Map", runScenarios[0]?.map ?? "Town05"],
            ["SUT", `${campaign?.sutName ?? "AutoScenarioX SUT"} ${campaign?.sutVersion ?? "1.0.0"}`],
            ["Driving agent", campaign?.agent ?? "Behavior Agent"],
            ["Oracle profile", campaign?.oracleProfile ?? "Default safety profile"],
            ["Execution strategy", campaign?.strategy ?? "Risk-first"],
            ["Random seed", String(campaign?.randomSeed ?? 42)],
          ].map(([label, value]) => (
            <div className="context-row" key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
          <button
            className="link-button"
            onClick={() => onNavigate("failures")}
          >
            Review failure evidence <Icon name="arrow-right" size={13} />
          </button>
        </aside>
      </div>
    </div>
  );
}

function ReviewQueue({
  user,
  failures,
  onFailureConfirm,
  onScenarioReexecute,
  onNavigate,
}: RolePagesProps) {
  const [inspectingFailure, setInspectingFailure] =
    useState<FailureCluster | null>(null);
  const [verifiedLabel, setVerifiedLabel] = useState("");
  const [verifiedRootCause, setVerifiedRootCause] = useState("");
  const inspectFailure = (failure: FailureCluster) => {
    setInspectingFailure(failure);
    setVerifiedLabel(failure.label);
    setVerifiedRootCause(failure.rootCause);
  };
  const pendingFailures = failures.filter(
    (failure) => failure.reviewStatus === "Needs review",
  );
  return (
    <div className="role-page-stack">
      <section className="review-summary">
        <div>
          <span className="review-summary-icon">
            <Icon name="shield" size={20} />
          </span>
          <div>
            <small>REVIEW WORKSPACE</small>
            <h2>Failure analysis backed by evidence</h2>
            <p>
              Confirm explainable root-cause labels using execution evidence.
            </p>
          </div>
        </div>
        <div className="review-counts">
          <span>
            <b>{pendingFailures.length}</b>
            <small>failure labels to confirm</small>
          </span>
        </div>
      </section>
      <section className="card review-card">
        <div className="section-head">
          <div>
            <small className="section-kicker">ROOT-CAUSE REVIEW</small>
            <h3>Failure clusters to confirm</h3>
            <p>
              Use oracle evidence and recurring patterns to confirm a label.
            </p>
          </div>
          <button
            className="link-button"
            onClick={() => onNavigate("failures")}
          >
            All failure insights <Icon name="arrow-right" size={13} />
          </button>
        </div>
        {pendingFailures.length ? (
          pendingFailures.map((failure) => (
            <article className="review-row failure-review-row" key={failure.id}>
              <span className="failure-severity-mark">
                <Icon name="warning" size={16} />
              </span>
              <div className="review-row-main">
                <b>{failure.label}</b>
                <small>
                  {failure.id} · {failure.affectedRuns} affected runs ·{" "}
                  {failure.map}
                </small>
                <p>{failure.rootCause}</p>
                <span className="review-tags">
                  <span className="confidence-chip">
                    {Math.round(failure.confidence)}% confidence
                  </span>
                  <small>
                    {failure.evidence.length} evidence points ·{" "}
                    {failure.scenarioName}
                  </small>
                </span>
              </div>
              <div className="review-actions">
                <button
                  className="btn btn-light btn-xs"
                  onClick={() => inspectFailure(failure)}
                >
                  Inspect evidence
                </button>
                <button
                  className="btn btn-primary btn-xs"
                  onClick={() => onFailureConfirm(failure)}
                >
                  Confirm root cause
                </button>
              </div>
            </article>
          ))
        ) : (
          <EmptyPanel text="All detected root causes have been reviewed." />
        )}
      </section>
      {inspectingFailure && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setInspectingFailure(null);
          }}
        >
          <section className="modal review-detail-modal">
            <div className="modal-head">
              <div>
                <small className="section-kicker">
                  ROOT-CAUSE EVIDENCE · {inspectingFailure.id}
                </small>
                <h2>{inspectingFailure.label}</h2>
                <p>{inspectingFailure.rootCause}</p>
              </div>
              <button
                onClick={() => setInspectingFailure(null)}
                aria-label="Close failure evidence"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="review-detail-grid">
              <div>
                <small>Related scenario</small>
                <b>{inspectingFailure.scenarioName}</b>
              </div>
              <div>
                <small>CARLA map</small>
                <b>{inspectingFailure.map}</b>
              </div>
              <div>
                <small>Affected runs</small>
                <b>{inspectingFailure.affectedRuns}</b>
              </div>
              <div>
                <small>Model confidence</small>
                <b>{Math.round(inspectingFailure.confidence)}%</b>
              </div>
            </div>
            <div className="review-evidence-list">
              <small className="section-kicker">ORACLE EVIDENCE</small>
              {inspectingFailure.evidence.map((item, index) => (
                <div key={`${item.rule}-${index}`}>
                  <b>{item.rule}</b>
                  <small>
                    {item.timestamp} · measured {item.measured} · threshold{" "}
                    {item.threshold}
                  </small>
                  <p>{item.note}</p>
                </div>
              ))}
            </div>
            <label>
              Verified root-cause classification
              <input value={verifiedLabel} onChange={(event) => setVerifiedLabel(event.target.value)} maxLength={160} required />
            </label>
            <label>
              Reviewer explanation
              <textarea value={verifiedRootCause} onChange={(event) => setVerifiedRootCause(event.target.value)} rows={3} maxLength={1200} required />
            </label>
            <div className="modal-actions">
              <button
                className="btn btn-light"
                onClick={() => setInspectingFailure(null)}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                disabled={!verifiedLabel.trim() || !verifiedRootCause.trim()}
                onClick={() => {
                  onFailureConfirm(inspectingFailure, {
                    label: verifiedLabel.trim(),
                    rootCause: verifiedRootCause.trim(),
                    reviewerNote: "Reviewed in the failure queue.",
                    reviewedBy: user.name,
                  });
                  setInspectingFailure(null);
                }}
              >
                <Icon name="check" size={15} />
                Confirm root cause
              </button>
              <button
                className="btn btn-light"
                onClick={() => {
                  onScenarioReexecute(inspectingFailure);
                  setInspectingFailure(null);
                }}
              >
                Request re-execution
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CampaignReport({
  campaigns,
  scenarios,
  runs,
  failures,
  onNavigate,
}: RolePagesProps) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const campaign =
    campaigns.find((item) => item.id === campaignId) ?? campaigns[0];
  const selectedScenarios = campaign
    ? scenarios.filter((scenario) => campaign.scenarioIds.includes(scenario.id))
    : [];
  const campaignRuns = campaign ? runs.filter((run) => run.campaignId === campaign.id) : [];
  const completedRuns = campaignRuns.filter((run) => run.verdict === "PASS" || run.verdict === "FAIL" || run.verdict === "TIMEOUT");
  const passRate = completedRuns.length ? (completedRuns.filter((run) => run.verdict === "PASS").length / completedRuns.length) * 100 : undefined;
  const duration = completedRuns.length
    ? `${Math.floor(completedRuns.reduce((sum, run) => sum + (run.durationSeconds ?? 0), 0) / 60)}m`
    : "No run data";
  const [ranking, setRanking] = useState<{ apfd: string; apfdc: string; baselineApfd: string; baselineApfdc: string; strategy: string } | undefined>(
    () => campaign ? getRanking<{ apfd: string; apfdc: string; baselineApfd: string; baselineApfdc: string; strategy: string }>(campaign.id) : undefined,
  );
  useEffect(() => {
    if (!campaign) return;
    if (isMockMode) {
      setRanking(getRanking(campaign.id));
      return;
    }
    let active = true;
    void api.getCampaignRanking(campaign.id).then((value) => {
      if (active) setRanking(value as typeof ranking);
    }).catch(() => {
      if (active) setRanking(undefined);
    });
    return () => { active = false; };
  }, [campaign?.id]);
  const campaignFailures = failures.filter((failure) => selectedScenarios.some((scenario) => scenario.name === failure.scenarioName));
  return (
    <div className="role-page-stack">
      <section className="report-hero">
        <div>
          <small>CAMPAIGN ANALYTICS · REPORT</small>
          <h2>Safety campaign report</h2>
          <p>Outcome summary, scenario coverage and prioritized follow-up.</p>
        </div>
        <button
          className="btn btn-white"
          disabled={!campaign}
          onClick={() => campaign && downloadCsv(`${campaign.id}-campaign-report.csv`, [
            ["Campaign", campaign.name],
            ["Status", campaign.status],
            ["Strategy", ranking?.strategy ?? campaign.strategy],
            ["APFD", ranking?.apfd ?? "Unavailable"],
            ["Seeded random baseline APFD", ranking?.baselineApfd ?? "Unavailable"],
            ["APFDc (estimated)", ranking?.apfdc ?? "Unavailable"],
            ["Seeded random baseline APFDc", ranking?.baselineApfdc ?? "Unavailable"],
            ["Run ID", "Scenario ID", "Scenario version", "Verdict", "Duration seconds", "Worker", "Evidence"],
            ...campaignRuns.map((run) => [run.id, run.scenarioId, run.scenarioVersion, run.verdict ?? run.state, run.durationSeconds ?? "", run.workerId ?? "", run.evidence.map((evidence) => `${evidence.rule} ${evidence.measured} threshold ${evidence.threshold}`).join("; ")]),
          ])}
        >
          <Icon name="download" size={15} />
          Export report
        </button>
      </section>
      <div className="report-filter">
        <span>
          <Icon name="calendar" size={15} /> Reporting period:{" "}
          <b>Last 30 days</b>
        </span>
        <label>
          Campaign
          <select
            value={campaign?.id ?? ""}
            onChange={(event) => setCampaignId(event.target.value)}
          >
            {campaigns.map((item) => (
              <option value={item.id} key={item.id}>
                {item.id} · {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {campaign && (
        <>
          <div className="metric-grid">
            <MiniMetric
              label="SCENARIOS TESTED"
              value={String(selectedScenarios.length)}
              icon="scenarios"
              tone="violet"
            />
            <MiniMetric
              label="PASS RATE"
              value={passRate === undefined ? "—" : `${passRate.toFixed(1)}%`}
              icon="check"
              tone="green"
            />
            <MiniMetric
              label="FAILED RUNS"
              value={String(completedRuns.filter((run) => run.verdict === "FAIL" || run.verdict === "TIMEOUT").length)}
              icon="warning"
              tone="orange"
            />
            <MiniMetric
              label="EXECUTION TIME"
              value={duration}
              icon="clock"
              tone="blue"
            />
          </div>
          <div className="report-grid">
            <section className="card report-chart-card">
              <div className="section-head">
                <div>
                  <small className="section-kicker">QUALITY TREND</small>
                  <h3>Pass rate over executions</h3>
                  <p>{campaign.name} · result stability trend</p>
                </div>
                <Badge value={campaign.status} />
              </div>
              <div className="report-bars">
                {(completedRuns.length
                  ? completedRuns.map((_, index) => Math.round(((completedRuns.slice(0, index + 1).filter((run) => run.verdict === "PASS").length) / (index + 1)) * 100))
                  : [0]).map((value, index) => (
                  <div key={index}>
                    <span style={{ height: `${value}%` }} title={`${value}%`} />
                    <small>
                      {["W1", "W2", "W3", "W4", "W5", "W6", "W7", "Now"][index]}
                    </small>
                  </div>
                ))}
              </div>
              <div className="report-chart-legend">
                <span>
                  <i />
                  Pass rate
                </span>
                <small>{completedRuns.length ? `${completedRuns.length} completed run records` : "No completed run records"}</small>
              </div>
            </section>
            <section className="card report-findings">
              <small className="section-kicker">KEY FINDINGS</small>
              <h3>Recommended follow-up</h3>
              {[
                  [
                    "Review high-risk failures",
                    `${campaignFailures.length} linked failure clusters have evidence ready for review`,
                  "warning",
                ],
                [
                  "Expand weather coverage",
                  "Add more fog and heavy-rain scenarios",
                  "cloud",
                ],
                [
                  "Tune campaign order",
                    ranking ? `${ranking.strategy} · APFD ${ranking.apfd} / ${ranking.baselineApfd}; APFDc ${ranking.apfdc} / ${ranking.baselineApfdc}` : "Run prioritization to calculate APFD/APFDc for this campaign",
                  "priority",
                ],
              ].map(([title, detail, icon]) => (
                <div className="finding-row" key={title}>
                  <span>
                    <Icon
                      name={icon as "warning" | "cloud" | "priority"}
                      size={15}
                    />
                  </span>
                  <div>
                    <b>{title}</b>
                    <small>{detail}</small>
                  </div>
                </div>
              ))}
              <button
                className="btn btn-light"
                onClick={() => onNavigate("failures")}
              >
                Open failure analysis <Icon name="arrow-right" size={14} />
              </button>
            </section>
          </div>
          <section className="card report-scenario-list">
            <div className="section-head">
              <div>
                <small className="section-kicker">SCENARIO RESULTS</small>
                <h3>Coverage by scenario</h3>
              </div>
              <span>{selectedScenarios.length} scenarios</span>
            </div>
            <div className="role-table-wrap">
              <table className="role-table">
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Risk</th>
                    <th>Executions</th>
                    <th>Pass rate</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedScenarios.map((scenario) => (
                    <tr key={scenario.id}>
                      <td>
                        <b>{scenario.name}</b>
                        <small>
                          {scenario.id} · {scenario.map}
                        </small>
                      </td>
                      <td>
                        <Badge value={scenario.severity} />
                      </td>
                      <td>{scenario.runCount}</td>
                <td>{scenario.runCount ? `${scenario.passRate.toFixed(1)}%` : "—"}</td>
                      <td>{scenario.priorityScore}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function UserManagement({ onNotify }: RolePagesProps) {
  const apiMode = isAuthApiEnabled;
  const dispatch = useDispatch<AppDispatch>();
  const auth = useSelector((state: RootState) => state.auth);
  const seed: (DemoUser & { status: "Active" | "Invited" })[] = [
    {
      name: "Linh Nguyen",
      email: "scenario@autoscenariox.dev",
      role: "Scenario Engineer",
      status: "Active",
    },
    {
      name: "Bao Doan",
      email: "tester@autoscenariox.dev",
      role: "Test Engineer",
      status: "Active",
    },
    {
      name: "Mai Tran",
      email: "reviewer@autoscenariox.dev",
      role: "Test Reviewer",
      status: "Active",
    },
    {
      name: "Alex Pham",
      email: "admin@autoscenariox.dev",
      role: "Administrator",
      status: "Active",
    },
    {
      name: "Tuan Le",
      email: "tuan.le@mobility-lab.dev",
      role: "Scenario Engineer",
      status: "Invited",
    },
  ];
  const [users, setUsers] = useState(
    () =>
      (JSON.parse(localStorage.getItem("asx-admin-users") ?? "null") as
        typeof seed | null) ?? seed,
  );
  useEffect(() => {
    if (apiMode) dispatch(adminUsersRequested());
  }, [apiMode, dispatch]);

  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const directoryUsers: (DemoUser & { id?: string; status: "Active" | "Invited" })[] = apiMode
    ? auth.adminUsers.map((user) => ({ ...user, status: "Active" as const }))
    : users;
  const visible = directoryUsers.filter((user) =>
    `${user.name} ${user.email} ${user.role}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  function update(next: typeof seed) {
    setUsers(next);
    localStorage.setItem("asx-admin-users", JSON.stringify(next));
  }
  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    update([
      {
        name: String(data.get("name")),
        email,
        role: String(data.get("role")) as UserRole,
        status: "Invited",
      },
      ...users,
    ]);
    setInviteOpen(false);
    onNotify(`Invitation prepared for ${email}.`);
  }
  return (
    <div className="role-page-stack">
      <section className="admin-page-hero">
        <div>
          <span>
            <Icon name="users" size={18} />
          </span>
          <div>
            <small className="section-kicker">
              ADMINISTRATION · ACCESS CONTROL
            </small>
            <h3>Manage workspace members</h3>
            <p>
              Assign roles and check account access. Backend authorization is
              still required for production use.
            </p>
          </div>
        </div>
        {!apiMode && (
          <button className="btn btn-primary" onClick={() => setInviteOpen(true)}>
            <Icon name="plus" size={15} />
            Invite user
          </button>
        )}
      </section>
      <div className="admin-stat-row">
        <MiniMetric
          label="TOTAL MEMBERS"
          value={String(directoryUsers.length).padStart(2, "0")}
          icon="users"
          tone="violet"
        />
        <MiniMetric
          label="ACTIVE USERS"
          value={String(
            directoryUsers.filter((user) => user.status === "Active").length,
          ).padStart(2, "0")}
          icon="check"
          tone="green"
        />
        <MiniMetric
          label="PENDING INVITES"
          value={String(
            directoryUsers.filter((user) => user.status === "Invited").length,
          ).padStart(2, "0")}
          icon="clock"
          tone="orange"
        />
        <MiniMetric label="ROLE TYPES" value="04" icon="shield" tone="blue" />
      </div>
      <section className="card admin-users-card">
        <div className="admin-table-tools">
          <div>
            <small className="section-kicker">TEAM DIRECTORY</small>
            <h3>
              Workspace users <span>{visible.length}</span>
            </h3>
          </div>
          <label className="admin-search">
            <Icon name="search" size={15} />
            <input
              placeholder="Search users..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="role-table-wrap">
          <table className="role-table user-role-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last active</th>
                {!apiMode && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => (
                <tr key={user.id ?? user.email}>
                  <td>
                    <div className="user-cell">
                      <span>
                        {user.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      </span>
                      <div>
                        <b>{user.name}</b>
                        <small>{user.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      value={user.role}
                      disabled={apiMode && auth.adminUsersBusy}
                      onChange={(event) => {
                        const nextRole = event.target.value as UserRole;
                        if (apiMode && user.id) {
                          dispatch(adminRoleChangeRequested({ id: user.id, role: nextRole }));
                        } else {
                          update(
                            users.map((item) =>
                              item.email === user.email
                                ? { ...item, role: nextRole }
                                : item,
                            ),
                          );
                        }
                      }}
                    >
                      {[
                        "Scenario Engineer",
                        "Test Engineer",
                        "Test Reviewer",
                        "Administrator",
                      ].map((role) => (
                        <option key={role}>{role}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span
                      className={`member-state ${user.status.toLowerCase()}`}
                    >
                      <i />
                      {user.status}
                    </span>
                  </td>
                  <td>{apiMode ? "—" : user.status === "Active" ? "Today, 09:42" : "Invitation sent"}</td>
                  {!apiMode && (
                    <td>
                      <button
                        className="link-button"
                        onClick={() => {
                          update(users.filter((item) => item.email !== user.email));
                          onNotify(`${user.email} removed from this mock directory.`);
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {auth.adminUsersBusy && directoryUsers.length === 0 && (
            <div className="empty-state">Loading users…</div>
          )}
          {auth.adminUsersError && (
            <div className="auth-message auth-error" role="alert">{auth.adminUsersError}</div>
          )}
        </div>
        <div className="admin-security-note">
          <Icon name="shield" size={16} />
          <span>
            {apiMode ? (
              <><b>Role changes are checked by the .NET API.</b> The affected user must sign in again for the new role to appear in their access token.</>
            ) : (
              <><b>Role-based navigation is a frontend preview.</b> Enforce all permissions in the .NET API before connecting real accounts.</>
            )}
          </span>
        </div>
      </section>
      {inviteOpen && !apiMode && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setInviteOpen(false);
          }}
        >
          <form className="modal" onSubmit={invite}>
            <div className="modal-head">
              <div>
                <h2>Invite workspace member</h2>
                <p>Prepare a local demo invitation with a role assignment.</p>
              </div>
              <button type="button" onClick={() => setInviteOpen(false)}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <label>
              Full name
              <input required name="name" placeholder="New teammate" />
            </label>
            <label>
              Work email
              <input
                required
                type="email"
                name="email"
                placeholder="name@company.com"
              />
            </label>
            <label>
              Workspace role
              <select name="role">
                {[
                  "Scenario Engineer",
                  "Test Engineer",
                  "Test Reviewer",
                  "Administrator",
                ].map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button
                className="btn btn-light"
                type="button"
                onClick={() => setInviteOpen(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit">
                <Icon name="check" size={15} />
                Prepare invite
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function AnalyticsSettings({ onNotify }: RolePagesProps) {
  const [settings, setSettings] = useState<AnalyticsPreferences>(() => {
    const stored = getAnalyticsPreferences();
    try {
      const legacy = JSON.parse(localStorage.getItem("asx-analytics") ?? "null") as {
        days?: string; includeDrafts?: boolean; group?: string; weeklyEmail?: boolean;
      } | null;
      return {
        ...stored,
        reportDays: legacy?.days ?? stored.reportDays,
        includeDrafts: legacy?.includeDrafts ?? stored.includeDrafts,
        group: legacy?.group ?? stored.group,
        weeklyEmail: legacy?.weeklyEmail ?? stored.weeklyEmail,
      };
    } catch {
      return stored;
    }
  });
  useEffect(() => {
    if (isMockMode) return;
    let active = true;
    void api.getAnalyticsPreferences().then((value) => {
      if (!active) return;
      setSettings(value);
      saveAnalyticsPreferences(value);
    }).catch((error: unknown) => {
      if (active) onNotify(error instanceof Error ? error.message : "Could not load analytics settings.");
    });
    return () => { active = false; };
  }, []);
  function patch(changes: Partial<AnalyticsPreferences>) {
    setSettings((current) => ({ ...current, ...changes }));
  }
  function patchWeight(feature: keyof AnalyticsPreferences["featureWeights"], value: number) {
    setSettings((current) => ({
      ...current,
      featureWeights: { ...current.featureWeights, [feature]: value },
    }));
  }
  async function save() {
    if (!(settings.similarityWarning >= 0 && settings.similarityWarning < settings.similarityBlock && settings.similarityBlock <= 1)) {
      onNotify("Similarity thresholds must satisfy 0 ≤ warning < block ≤ 1.");
      return;
    }
    const weights = Object.values(settings.featureWeights);
    if (weights.some((weight) => !Number.isFinite(weight) || weight < 0) || weights.every((weight) => weight === 0)) {
      onNotify("Feature weights must be non-negative and at least one must be above zero.");
      return;
    }
    if (!Number.isInteger(settings.retentionDays) || settings.retentionDays < 1) {
      onNotify("Evidence retention must be at least one day.");
      return;
    }
    let saved = settings;
    try {
      saved = await api.saveAnalyticsPreferences(settings);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "Could not save analytics settings.");
      return;
    }
    saveAnalyticsPreferences(saved);
    localStorage.setItem("asx-analytics", JSON.stringify({
      days: settings.reportDays,
      includeDrafts: settings.includeDrafts,
      group: settings.group,
      weeklyEmail: settings.weeklyEmail,
    }));
    appendAuditEvent({ actor: "Current administrator", action: "Updated analytics and similarity settings", target: "Workspace analytics", result: "Success" });
    onNotify(isMockMode ? "Analytics settings saved in this browser." : "Analytics settings saved to the backend.");
  }
  return (
    <div className="role-page-stack">
      <section className="card analytics-intro">
        <div className="analytics-symbol">
          <Icon name="priority" size={20} />
        </div>
        <div>
          <small className="section-kicker">SYSTEM SETTINGS · ANALYTICS</small>
          <h3>Control how workspace insights are prepared</h3>
          <p>
            Adjust mock report scope and grouping. These preferences can later
            map to backend query options.
          </p>
        </div>
        <button className="btn btn-primary" onClick={save}>
          <Icon name="check" size={15} />
          Save settings
        </button>
      </section>
      <div className="analytics-settings-grid">
        <section className="card settings-card">
          <small className="section-kicker">REPORT DEFAULTS</small>
          <h3>Default analysis scope</h3>
          <p>Used when opening dashboards and campaign reports.</p>
          <label>
            Time range
            <select
              value={settings.reportDays}
              onChange={(event) => patch({ reportDays: event.target.value })}
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
            </select>
          </label>
          <label>
            Group results by
            <select
              value={settings.group}
              onChange={(event) => patch({ group: event.target.value })}
            >
              <option value="severity">Risk severity</option>
              <option value="map">CARLA map</option>
              <option value="category">Scenario category</option>
              <option value="campaign">Campaign</option>
            </select>
          </label>
          <ToggleRow
            title="Include draft scenarios"
            detail="Include scenarios that have not passed review."
            checked={settings.includeDrafts}
            onChange={(checked) => patch({ includeDrafts: checked })}
          />
          <div className="setting-divider" />
          <small className="section-kicker">SCENARIO SIMILARITY · GOWER</small>
          <div className="analytics-number-grid">
            <label>Review warning threshold<input type="number" min="0" max="1" step="0.01" value={settings.similarityWarning} onChange={(event) => patch({ similarityWarning: Number(event.target.value) })} /></label>
            <label>Duplicate block threshold<input type="number" min="0" max="1" step="0.01" value={settings.similarityBlock} onChange={(event) => patch({ similarityBlock: Number(event.target.value) })} /></label>
          </div>
          <p>Feature weights used by scenario comparison</p>
          <div className="analytics-weight-grid">
            {(["map", "category", "weather", "severity", "actors"] as const).map((feature) => (
              <label key={feature}>{feature[0].toUpperCase() + feature.slice(1)}<input type="number" min="0" step="0.1" value={settings.featureWeights[feature]} onChange={(event) => patchWeight(feature, Number(event.target.value))} /></label>
            ))}
          </div>
        </section>
        <section className="card settings-card">
          <small className="section-kicker">DELIVERY & PRIVACY</small>
          <h3>Analytics delivery</h3>
          <p>Choose how reviewers receive summarized insights.</p>
          <ToggleRow
            title="Weekly summary email"
            detail="Prepare a weekly report for workspace administrators."
            checked={settings.weeklyEmail}
            onChange={(checked) => patch({ weeklyEmail: checked })}
          />
          <div className="setting-divider" />
          <label>
            Evidence retention (days)
            <input type="number" min="1" max="3650" value={settings.retentionDays} onChange={(event) => patch({ retentionDays: Number(event.target.value) })} />
          </label>
          <div className="privacy-box">
            <Icon name="shield" size={17} />
            <div>
              <b>Evidence remains traceable</b>
              <small>
                Report summaries link back to source runs, oracle thresholds and
                reviewer decisions.
              </small>
            </div>
          </div>
          <button
            className="link-button"
            onClick={() => onNotify("Data retention policy preview opened.")}
          >
            Review data retention <Icon name="arrow-right" size={13} />
          </button>
        </section>
      </div>
      <section className="card analytics-preview">
        <div>
          <small className="section-kicker">CURRENT PREVIEW</small>
          <h3>Report settings summary</h3>
        </div>
        <div className="analytics-preview-pills">
          <span>{settings.reportDays} day window</span>
          <span>Grouped by {settings.group}</span>
          <span>
            {settings.includeDrafts ? "Drafts included" : "Approved data only"}
          </span>
          <span>
            {settings.weeklyEmail
              ? "Weekly summary enabled"
              : "No scheduled summary"}
          </span>
          <span>{Math.round(settings.similarityWarning * 100)}% / {Math.round(settings.similarityBlock * 100)}% similarity thresholds</span>
          <span>{settings.retentionDays} day evidence retention</span>
        </div>
      </section>
    </div>
  );
}

function AuditLog({ onNotify }: RolePagesProps) {
  void onNotify;
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(listAuditEvents);
  useEffect(() => {
    if (isMockMode) return;
    let active = true;
    void api.listAuditEvents().then((events) => {
      if (active) setAuditEvents(events);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const entries = useMemo(() => auditEvents.map((event: AuditEvent) => {
    const action = event.action.toLowerCase();
    const category = action.includes("scenario") ? "Scenario"
      : action.includes("campaign") || action.includes("run") || action.includes("oracle verdict") ? "Execution"
        : action.includes("failure") || action.includes("review") || action.includes("root cause") ? "Review"
          : action.includes("worker") || action.includes("carla") || action.includes("node") ? "Infrastructure"
            : action.includes("analytics") || action.includes("report") ? "Analytics"
              : action.includes("user") || action.includes("role") || action.includes("access") ? "Access"
                : "Configuration";
    return { ...event, category };
  }), [auditEvents]);
  const [filter, setFilter] = useState("All activity");
  const [query, setQuery] = useState("");
  const visible = entries.filter((entry) =>
    (filter === "All activity" || entry.category === filter) &&
    `${entry.time} ${entry.action} ${entry.target} ${entry.actor} ${entry.result} ${entry.category}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="role-page-stack">
      <section className="admin-page-hero">
        <div>
          <span>
            <Icon name="clock" size={18} />
          </span>
          <div>
            <small className="section-kicker">ADMINISTRATION · AUDIT</small>
            <h3>Workspace activity log</h3>
            <p>
              Review who changed a scenario, started a campaign or updated
              system configuration.
            </p>
          </div>
        </div>
        <button
          className="btn btn-light"
          onClick={() => downloadCsv("autoscenariox-audit-log.csv", [["Time", "Event", "Resource", "Actor", "Result", "Category"], ...visible.map(({ time, action, target, actor, result, category }) => [time, action, target, actor, result, category])])}
        >
          <Icon name="download" size={15} />
          Export log
        </button>
      </section>
      <section className="card audit-card">
        <div className="admin-table-tools">
          <div>
            <small className="section-kicker">IMMUTABLE EVENT VIEW</small>
            <h3>
              Recent activity <span>{visible.length}</span>
            </h3>
          </div>
          <div className="audit-tools">
            <label className="admin-search">
              <Icon name="search" size={15} />
              <input
                placeholder="Search events..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              {[
                "All activity",
                "Review",
                "Execution",
                "Configuration",
                "Scenario",
                "Access",
                "Infrastructure",
                "Analytics",
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="role-table-wrap">
          <table className="role-table audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Resource</th>
                <th>Actor</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ id, time, action, target, actor, result, category }) => (
                <tr key={id}>
                  <td className="audit-time">{time}</td>
                  <td>
                    <span
                      className={`audit-event audit-${category.toLowerCase()}`}
                    >
                      <i />
                      {action}
                    </span>
                  </td>
                  <td>{target}</td>
                  <td>{actor}</td>
                  <td>
                    <span className="audit-category">{category} · {result}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <EmptyPanel text="No activity matches this filter." />
          )}
        </div>
        <div className="audit-foot">
          <Icon name="shield" size={14} />
          Events are stored in this browser for the frontend mock. The backend audit endpoint can replace this source later.
        </div>
      </section>
    </div>
  );
}

function Profile({ user, onUserUpdate, onNotify, onLogout }: RolePagesProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [weekly, setWeekly] = useState(true);
  const [reviewAlerts, setReviewAlerts] = useState(true);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onUserUpdate({ ...user, name: name.trim(), email: email.trim() });
    onNotify("Profile updated in this browser session.");
  }
  return (
    <div className="role-page-stack">
      <section className="profile-hero">
        <span className="profile-large-avatar">
          {user.name
            .split(" ")
            .map((part) => part[0])
            .join("")}
        </span>
        <div>
          <small>MY WORKSPACE ACCOUNT</small>
          <h2>{user.name}</h2>
          <p>{user.role} · Urban Mobility Lab</p>
        </div>
        <span className="profile-status">
          <i /> Demo account
        </span>
      </section>
      <div className="profile-layout">
        <form className="card profile-form" onSubmit={save}>
          <small className="section-kicker">PERSONAL INFORMATION</small>
          <h3>Profile details</h3>
          <p>Keep your workspace identity up to date.</p>
          <label>
            Full name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Workspace role
            <input value={user.role} readOnly />
          </label>
          <div className="editor-form-actions">
            <button className="btn btn-light" type="button" onClick={onLogout}>
              Sign out
            </button>
            <button className="btn btn-primary" type="submit">
              <Icon name="check" size={15} />
              Save profile
            </button>
          </div>
        </form>
        <div className="profile-side">
          <section className="card settings-card">
            <small className="section-kicker">NOTIFICATIONS</small>
            <h3>What should reach you?</h3>
            <ToggleRow
              title="Review updates"
              detail="Scenario and root-cause review decisions."
              checked={reviewAlerts}
              onChange={setReviewAlerts}
            />
            <ToggleRow
              title="Weekly digest"
              detail="Campaign outcome and worker summary."
              checked={weekly}
              onChange={setWeekly}
            />
          </section>
          <section className="card profile-role-card">
            <span>
              <Icon name="shield" size={17} />
            </span>
            <div>
              <b>Role-based workspace</b>
              <small>
                Your current navigation is tailored for {user.role}. Use the
                role preview in the top bar to inspect other mock role screens.
              </small>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon:
    | "activity"
    | "clock"
    | "check"
    | "nodes"
    | "scenarios"
    | "warning"
    | "users"
    | "shield"
    | "priority";
  tone: string;
}) {
  return (
    <div className="card mini-metric">
      <span className={`mini-metric-icon ${tone}`}>
        <Icon name={icon} size={16} />
      </span>
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}
function ToggleRow({
  title,
  detail,
  checked,
  onChange,
}: {
  title: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="toggle-row">
      <span>
        <b>{title}</b>
        <small>{detail}</small>
      </span>
      <button
        type="button"
        className={`toggle ${checked ? "on" : ""}`}
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
      >
        <i />
      </button>
    </div>
  );
}
function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="role-empty">
      <span>
        <Icon name="search" size={17} />
      </span>
      <b>{text}</b>
    </div>
  );
}
function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value.toLowerCase().replaceAll(" ", "-")}`}>
      {value}
    </span>
  );
}
