import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Icon } from "./Icon";
import type {
  AppPage,
  Campaign,
  DemoUser,
  FailureCluster,
  Scenario,
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
  workers: WorkerNode[];
  onNavigate: (page: AppPage) => void;
  onNotify: (message: string) => void;
  onScenarioStatus: (id: string, status: ScenarioStatus) => void;
  onScenarioUpdate: (id: string, changes: Partial<Scenario>) => void;
  onImport: (scenario: Scenario) => void;
  onFailureConfirm: (failure: FailureCluster) => void;
  onCampaignStatus: (id: string, status: Campaign["status"]) => void;
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
    text: "Create, import and compare reusable road situations. Submitted scenarios go to review before they can be used in campaigns.",
    icon: "scenarios",
  },
  "Test Engineer": {
    title: "Turn scenarios into safety evidence",
    text: "Build risk-focused campaigns, monitor execution and inspect explainable test failures.",
    icon: "play",
  },
  "Test Reviewer": {
    title: "Review evidence with context",
    text: "Validate scenario definitions and failure labels before the team relies on them.",
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
        detail: "Approve scenarios and root causes",
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
  onScenarioUpdate,
  onNotify,
  initialScenarioId,
}: RolePagesProps) {
  const [id, setId] = useState(initialScenarioId ?? scenarios[0]?.id ?? "");
  const selected = scenarios.find((scenario) => scenario.id === id);
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    onScenarioUpdate(selected.id, {
      name: String(data.get("name")),
      description: String(data.get("description")),
      map: String(data.get("map")),
      weather: String(data.get("weather")),
      category: String(data.get("category")),
      status: "Draft",
    });
    onNotify(`${selected.id} updated in the mock workspace.`);
  }
  return (
    <div className="role-page-stack">
      <section className="card editor-toolbar">
        <div>
          <small className="section-kicker">SCENARIO AUTHORING</small>
          <h3>Scenario editor</h3>
          <p>Edit a reusable test case and save a local draft.</p>
        </div>
        <label className="field-inline">
          Editing
          <select value={id} onChange={(event) => setId(event.target.value)}>
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
        <form className="card editor-form" key={id} onSubmit={save}>
          <div className="editor-form-main">
            <div className="editor-form-heading">
              <span className="editor-step">01</span>
              <div>
                <h3>Scenario definition</h3>
                <p>Describe the road context and environment variables.</p>
              </div>
              <span className="badge draft">DRAFT EDIT</span>
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
            <div className="editor-form-actions">
              <button
                className="btn btn-light"
                type="button"
                onClick={() =>
                  onNotify("Scenario preview refreshed from mock data.")
                }
              >
                Preview definition
              </button>
              <button className="btn btn-primary" type="submit">
                <Icon name="check" size={15} />
                Save draft
              </button>
            </div>
          </div>
          <aside className="editor-aside">
            <small className="section-kicker">VALIDATION CHECKLIST</small>
            {[
              ["Road context", "Map and category are defined"],
              ["Environment", "Weather preset is configured"],
              ["Review status", "Approval is required before campaign use"],
            ].map(([title, text], index) => (
              <div className="check-row" key={title}>
                <span className={index < 2 ? "check-on" : "check-wait"}>
                  <Icon name={index < 2 ? "check" : "clock"} size={13} />
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
                <b>Risk score {selected.priorityScore}/100</b>
                <small>Based on severity and recent execution history.</small>
              </span>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
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
    if (candidate.size > 25 * 1024 * 1024) {
      onNotify("The mock import limit is 25 MB.");
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
  function importFile() {
    if (!file) return;
    if (duplicate) {
      onNotify("A scenario with this name is already in the library.");
      return;
    }
    const name = file.name.replace(/\.(xosc|osc)$/i, "").replace(/[_-]+/g, " ");
    const scenario: Scenario = {
      id: `SCN-${Math.floor(100 + Math.random() * 899)}`,
      name,
      description: `Imported from ${file.name}. Review the scenario definition before approval.`,
      map: "Town05",
      category: "Urban",
      severity: "Medium",
      status: "Draft",
      version: "v0.1",
      weather: "Clear noon",
      actors: 3,
      runCount: 0,
      passRate: 0,
      lastRun: "Not run",
      owner: "Current user",
      tags: ["imported"],
      priorityScore: 52,
    };
    onImport(scenario);
    setFile(null);
    onNotify(`${scenario.id} was imported as a draft.`);
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
            Upload a .xosc or .osc file. The mock flow creates a draft record so
            it can be reviewed before campaign use.
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
            ? `${(file.size / 1024).toFixed(1)} KB · Ready for mock validation`
            : "or choose a file from your computer · .xosc, .osc · up to 25 MB"}
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
            ["Schema validation", "Structure and required fields"],
            ["Duplicate scan", "Compare against scenario library"],
            ["Review workflow", "Imported item starts as Draft"],
          ].map(([label, text], index) => (
            <div className="check-row" key={label}>
              <span className="check-on">
                <Icon name="check" size={13} />
              </span>
              <span>
                <b>{label}</b>
                <small>{text}</small>
              </span>
              <small>{index === 0 && file ? "READY" : "MOCK"}</small>
            </div>
          ))}
        </div>
        <div className="card import-side">
          <Icon name="shield" size={18} />
          <h3>Safe by default</h3>
          <p>
            Uploaded content stays in this browser demo. The connected backend
            should validate XML, enforce file limits and apply access rules.
          </p>
          <button
            className="link-button"
            onClick={() =>
              onNotify(
                "The .NET API will provide schema validation and duplicate detection.",
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

function ScenarioCompare({ scenarios, onNotify }: RolePagesProps) {
  const [leftId, setLeftId] = useState(scenarios[0]?.id ?? "");
  const [rightId, setRightId] = useState(
    scenarios[1]?.id ?? scenarios[0]?.id ?? "",
  );
  const left = scenarios.find((scenario) => scenario.id === leftId);
  const right = scenarios.find((scenario) => scenario.id === rightId);
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
          onClick={() =>
            onNotify("Comparison report prepared from mock scenario data.")
          }
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
                    group.items.filter((item) => item.status === "Approved")
                      .length
                  }{" "}
                  approved ·{" "}
                  {
                    group.items.filter((item) => item.status !== "Approved")
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
  onNavigate,
  onOpenCampaign,
  onCampaignStatus,
  onNotify,
}: RolePagesProps) {
  const running = campaigns.filter(
    (campaign) => campaign.status === "Running",
  ).length;
  const queued = campaigns.filter(
    (campaign) => campaign.status === "Queued",
  ).length;
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
          value="18"
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
                        onClick={() => {
                          onCampaignStatus(campaign.id, "Running");
                          onNotify(
                            `${campaign.name} started in the mock queue.`,
                          );
                        }}
                      >
                        Start run
                      </button>
                    ) : campaign.status === "Running" ? (
                      <button
                        className="btn btn-light btn-xs"
                        onClick={() => {
                          onCampaignStatus(campaign.id, "Completed");
                          onNotify(
                            `${campaign.name} marked complete in the mock queue.`,
                          );
                        }}
                      >
                        Complete
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
            <i /> Queue service simulated locally
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
  user,
  selectedCampaignId,
  onNavigate,
  onNotify,
}: RolePagesProps) {
  const campaign =
    campaigns.find((item) => item.id === selectedCampaignId) ??
    campaigns.find((item) => item.status === "Running") ??
    campaigns[0];
  const runScenarios = campaign
    ? scenarios.filter((scenario) => campaign.scenarioIds.includes(scenario.id))
    : [];
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
          <small>RUN DETAILS · RUN-2026-1048</small>
          <h2>{campaign?.name ?? "No active campaign"}</h2>
          <p>
            CARLA 0.9.15 · Behavior Agent 2.4.0-rc2 · Started today at 08:20
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
            Math.round(
              (runScenarios.length || 0) * ((campaign?.progress ?? 0) / 100),
            ),
          )}
          icon="check"
          tone="green"
        />
        <MiniMetric
          label="PASS RATE"
          value={`${campaign?.passRate ?? 0}%`}
          icon="activity"
          tone="blue"
        />
        <MiniMetric
          label="FAILED RUNS"
          value={String(campaign?.failedRuns ?? 0)}
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
              onClick={() =>
                onNotify(
                  "Run logs are generated when the .NET execution service is connected.",
                )
              }
            >
              <Icon name="external" size={14} />
              Open logs
            </button>
          </div>
          {runScenarios.length ? (
            runScenarios.map((scenario, index) => (
              <div className="run-item" key={scenario.id}>
                <span className={`run-dot run-dot-${index % 3}`}>
                  {index < 2 ? (
                    <Icon name="check" size={12} />
                  ) : (
                    <Icon name="clock" size={12} />
                  )}
                </span>
                <div>
                  <b>{scenario.name}</b>
                  <small>
                    {scenario.id} · {scenario.map} · {scenario.weather}
                  </small>
                </div>
                <span className="run-duration">
                  {index < 2 ? "00:03:42" : "Waiting"}
                </span>
                <Badge
                  value={index === 1 ? "FAIL" : index < 1 ? "PASS" : "Queued"}
                />
              </div>
            ))
          ) : (
            <EmptyPanel text="This campaign does not have linked scenarios." />
          )}
        </section>
        <aside className="card run-context">
          <small className="section-kicker">EXECUTION CONTEXT</small>
          <h3>Environment</h3>
          {[
            ["Simulation node", "carla-worker-02"],
            ["Map", runScenarios[0]?.map ?? "Town05"],
            ["Oracle profile", "Default safety profile v1.8"],
            ["Execution strategy", campaign?.strategy ?? "Risk-first"],
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
  scenarios,
  failures,
  onScenarioStatus,
  onFailureConfirm,
  onNotify,
  onNavigate,
}: RolePagesProps) {
  const [inspectingScenario, setInspectingScenario] = useState<Scenario | null>(
    null,
  );
  const [inspectingFailure, setInspectingFailure] =
    useState<FailureCluster | null>(null);
  const pendingScenarios = scenarios.filter(
    (scenario) => scenario.status === "In review",
  );
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
            <h2>Decisions backed by evidence</h2>
            <p>
              Review scenario quality and root-cause labels before they become
              trusted team data.
            </p>
          </div>
        </div>
        <div className="review-counts">
          <span>
            <b>{pendingScenarios.length}</b>
            <small>scenarios</small>
          </span>
          <i />
          <span>
            <b>{pendingFailures.length}</b>
            <small>failure labels</small>
          </span>
        </div>
      </section>
      <section className="card review-card">
        <div className="section-head">
          <div>
            <small className="section-kicker">SCENARIO APPROVAL</small>
            <h3>Scenarios waiting for review</h3>
            <p>Inspect the definition, then approve or return it to draft.</p>
          </div>
          <span className="badge needs-review">
            {pendingScenarios.length} PENDING
          </span>
        </div>
        {pendingScenarios.length ? (
          pendingScenarios.map((scenario) => (
            <article className="review-row" key={scenario.id}>
              <div className="review-scenario-symbol">
                <Icon
                  name={scenario.category === "Highway" ? "route" : "car"}
                  size={16}
                />
              </div>
              <div className="review-row-main">
                <b>{scenario.name}</b>
                <small>
                  {scenario.id} · {scenario.category} · {scenario.map} · owner{" "}
                  {scenario.owner}
                </small>
                <p>{scenario.description}</p>
                <span className="review-tags">
                  <Badge value={scenario.severity} />{" "}
                  <Badge value={scenario.status} />{" "}
                  <small>
                    {scenario.actors} actors · {scenario.weather}
                  </small>
                </span>
              </div>
              <div className="review-actions">
                <button
                  className="btn btn-light btn-xs"
                  onClick={() => setInspectingScenario(scenario)}
                >
                  Inspect
                </button>
                <button
                  className="btn btn-light btn-xs"
                  onClick={() => {
                    onScenarioStatus(scenario.id, "Draft");
                    onNotify(
                      `${scenario.id} returned to draft with a mock review note.`,
                    );
                  }}
                >
                  Request changes
                </button>
                <button
                  className="btn btn-primary btn-xs"
                  onClick={() => {
                    onScenarioStatus(scenario.id, "Approved");
                    onNotify(`${scenario.id} approved for campaign use.`);
                  }}
                >
                  Approve
                </button>
              </div>
            </article>
          ))
        ) : (
          <EmptyPanel text="There are no scenarios waiting for approval." />
        )}
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
                    {Math.round(failure.confidence * 100)}% confidence
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
                  onClick={() => setInspectingFailure(failure)}
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
      {inspectingScenario && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setInspectingScenario(null);
          }}
        >
          <section className="modal review-detail-modal">
            <div className="modal-head">
              <div>
                <small className="section-kicker">
                  SCENARIO REVIEW · {inspectingScenario.id}
                </small>
                <h2>{inspectingScenario.name}</h2>
                <p>{inspectingScenario.description}</p>
              </div>
              <button
                onClick={() => setInspectingScenario(null)}
                aria-label="Close scenario review"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="review-detail-grid">
              {[
                ["Category", inspectingScenario.category],
                ["CARLA map", inspectingScenario.map],
                ["Weather", inspectingScenario.weather],
                ["Severity", inspectingScenario.severity],
                ["Entities", `${inspectingScenario.actors} actors`],
                ["Owner", inspectingScenario.owner],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <b>{value}</b>
                </div>
              ))}
            </div>
            <div className="review-detail-note">
              <Icon name="shield" size={15} />
              <span>
                Confirm that the description is reproducible and has enough
                context for another engineer to recreate the test.
              </span>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-light"
                onClick={() => setInspectingScenario(null)}
              >
                Close
              </button>
              <button
                className="btn btn-light"
                onClick={() => {
                  onScenarioStatus(inspectingScenario.id, "Draft");
                  setInspectingScenario(null);
                  onNotify(`${inspectingScenario.id} returned to draft.`);
                }}
              >
                Request changes
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onScenarioStatus(inspectingScenario.id, "Approved");
                  setInspectingScenario(null);
                  onNotify(
                    `${inspectingScenario.id} approved for campaign use.`,
                  );
                }}
              >
                <Icon name="check" size={15} />
                Approve
              </button>
            </div>
          </section>
        </div>
      )}
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
                <b>{Math.round(inspectingFailure.confidence * 100)}%</b>
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
            <div className="modal-actions">
              <button
                className="btn btn-light"
                onClick={() => setInspectingFailure(null)}
              >
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onFailureConfirm(inspectingFailure);
                  setInspectingFailure(null);
                }}
              >
                <Icon name="check" size={15} />
                Confirm root cause
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
  onNotify,
  onNavigate,
}: RolePagesProps) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const campaign =
    campaigns.find((item) => item.id === campaignId) ?? campaigns[0];
  const selectedScenarios = campaign
    ? scenarios.filter((scenario) => campaign.scenarioIds.includes(scenario.id))
    : [];
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
          onClick={() =>
            onNotify(
              "PDF export will be available when the reporting API is connected.",
            )
          }
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
              value={`${campaign.passRate}%`}
              icon="check"
              tone="green"
            />
            <MiniMetric
              label="FAILED RUNS"
              value={String(campaign.failedRuns)}
              icon="warning"
              tone="orange"
            />
            <MiniMetric
              label="EXECUTION TIME"
              value={campaign.estimatedDuration}
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
                {[
                  72,
                  82,
                  77,
                  91,
                  86,
                  96,
                  88,
                  Math.max(12, campaign.passRate),
                ].map((value, index) => (
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
                <small>Mock values · illustrative</small>
              </div>
            </section>
            <section className="card report-findings">
              <small className="section-kicker">KEY FINDINGS</small>
              <h3>Recommended follow-up</h3>
              {[
                [
                  "Review high-risk failures",
                  "2 failure clusters have evidence ready for review",
                  "warning",
                ],
                [
                  "Expand weather coverage",
                  "Add more fog and heavy-rain scenarios",
                  "cloud",
                ],
                [
                  "Tune campaign order",
                  "Risk-first ordering can surface critical cases earlier",
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
                      <td>{scenario.passRate.toFixed(1)}%</td>
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
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const visible = users.filter((user) =>
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
        <button className="btn btn-primary" onClick={() => setInviteOpen(true)}>
          <Icon name="plus" size={15} />
          Invite user
        </button>
      </section>
      <div className="admin-stat-row">
        <MiniMetric
          label="TOTAL MEMBERS"
          value={String(users.length).padStart(2, "0")}
          icon="users"
          tone="violet"
        />
        <MiniMetric
          label="ACTIVE USERS"
          value={String(
            users.filter((user) => user.status === "Active").length,
          ).padStart(2, "0")}
          icon="check"
          tone="green"
        />
        <MiniMetric
          label="PENDING INVITES"
          value={String(
            users.filter((user) => user.status === "Invited").length,
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
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => (
                <tr key={user.email}>
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
                      onChange={(event) =>
                        update(
                          users.map((item) =>
                            item.email === user.email
                              ? {
                                  ...item,
                                  role: event.target.value as UserRole,
                                }
                              : item,
                          ),
                        )
                      }
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
                  <td>
                    {user.status === "Active"
                      ? "Today, 09:42"
                      : "Invitation sent"}
                  </td>
                  <td>
                    <button
                      className="link-button"
                      onClick={() => {
                        update(
                          users.filter((item) => item.email !== user.email),
                        );
                        onNotify(
                          `${user.email} removed from this mock directory.`,
                        );
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="admin-security-note">
          <Icon name="shield" size={16} />
          <span>
            <b>Role-based navigation is a frontend preview.</b> Enforce all
            permissions in the .NET API before connecting real accounts.
          </span>
        </div>
      </section>
      {inviteOpen && (
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
  const [settings, setSettings] = useState(
    () =>
      (JSON.parse(localStorage.getItem("asx-analytics") ?? "null") as {
        days: string;
        includeDrafts: boolean;
        group: string;
        weeklyEmail: boolean;
      } | null) ?? {
        days: "30",
        includeDrafts: false,
        group: "severity",
        weeklyEmail: true,
      },
  );
  function patch(changes: Partial<typeof settings>) {
    setSettings((current) => ({ ...current, ...changes }));
  }
  function save() {
    localStorage.setItem("asx-analytics", JSON.stringify(settings));
    onNotify("Analytics settings saved in this browser.");
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
              value={settings.days}
              onChange={(event) => patch({ days: event.target.value })}
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
          <span>{settings.days} day window</span>
          <span>Grouped by {settings.group}</span>
          <span>
            {settings.includeDrafts ? "Drafts included" : "Approved data only"}
          </span>
          <span>
            {settings.weeklyEmail
              ? "Weekly summary enabled"
              : "No scheduled summary"}
          </span>
        </div>
      </section>
    </div>
  );
}

function AuditLog({ onNotify }: RolePagesProps) {
  const entries = [
    [
      "09:42:18",
      "Scenario approved",
      "SCN-038 · Pedestrian crossing at dusk",
      "Mai Tran",
      "Review",
    ],
    [
      "09:37:04",
      "Campaign started",
      "CMP-108 · Night Drive Regression",
      "Bao Doan",
      "Execution",
    ],
    [
      "09:15:52",
      "Oracle threshold updated",
      "Minimum TTC · 2.0 s → 2.2 s",
      "Alex Pham",
      "Configuration",
    ],
    [
      "08:54:39",
      "Failure label confirmed",
      "FC-019 · Unsafe merge at Town05",
      "Mai Tran",
      "Review",
    ],
    [
      "08:31:12",
      "Scenario imported",
      "SCN-126 · Foggy bend stopping distance",
      "Linh Nguyen",
      "Scenario",
    ],
    [
      "08:20:06",
      "User role changed",
      "Tuan Le · Test Engineer → Scenario Engineer",
      "Alex Pham",
      "Access",
    ],
    [
      "Yesterday",
      "Simulation node reconnected",
      "carla-worker-03 · Town04",
      "System",
      "Infrastructure",
    ],
    [
      "Yesterday",
      "Campaign report generated",
      "CMP-106 · Weather Robustness v2",
      "Bao Doan",
      "Analytics",
    ],
  ];
  const [filter, setFilter] = useState("All activity");
  const [query, setQuery] = useState("");
  const visible = entries.filter(
    (entry) =>
      (filter === "All activity" || entry[4] === filter) &&
      entry.join(" ").toLowerCase().includes(query.toLowerCase()),
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
          onClick={() =>
            onNotify("Audit CSV prepared from the current mock filter.")
          }
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
              {visible.map(([time, event, resource, actor, category]) => (
                <tr key={`${time}-${event}`}>
                  <td className="audit-time">{time}</td>
                  <td>
                    <span
                      className={`audit-event audit-${category.toLowerCase()}`}
                    >
                      <i />
                      {event}
                    </span>
                  </td>
                  <td>{resource}</td>
                  <td>{actor}</td>
                  <td>
                    <span className="audit-category">{category}</span>
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
          Mock events shown for design preview · Connect the backend audit
          endpoint for authoritative records.
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
