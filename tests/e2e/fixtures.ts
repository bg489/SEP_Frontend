import { readFileSync } from 'node:fs';
import { test as base, expect, type Page, type Request, type Route } from '@playwright/test';
import type {
  TeamDraft, TeamObject, TeamReadyVersion, TeamScenarioDetail, TeamValidation, TeamVersion,
} from '../../src/services/teamContracts';
import type { CampaignCreateInput, TeamCampaign, TeamRun } from '../../src/services/teamOperations';
import type { DevRole } from '../../src/services/devRole';

const timestamp = '2026-10-28T08:00:00Z';
const uuid = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
export const ids = { draft: uuid(1), rain: uuid(2), highway: uuid(3), campaign: uuid(201), completed: uuid(202) };
export const content: TeamObject = {
  schema_version: '1.0',
  metadata: { name: 'Draft crossing', category: 'free_driving', description: 'Browser test draft' },
  map: { name: 'Town01' },
  route: { start: { spawn_point_index: 0 }, goal: { spawn_point_index: 1 } },
  ego_vehicle: { blueprint: 'vehicle.tesla.model3', target_speed_kmh: 30 },
  weather: { preset: 'ClearNoon' },
  traffic: { npc_vehicles: { count: 0 }, pedestrians: { count: 0 } },
  actors: [], events: [], parameters: {}, execution: { timeout_s: 60 },
  extensions: { future: { retained: true } },
};
const schema = JSON.parse(readFileSync(new URL('../../scripts/api-contracts/fixtures/scenario-schema-20261028.json', import.meta.url), 'utf8'));

function scenario(number: number, name: string, published = true): TeamScenarioDetail {
  const latestVersion: TeamVersion | null = published ? {
    id: uuid(100 + number), versionNumber: 1, status: 'READY', contentHash: `hash-${number}`,
    mapName: number === 3 ? 'Town02' : 'Town01', weatherPreset: number === 2 ? 'HardRainNoon' : 'ClearNoon',
    eventTypes: [], actorCount: 1, eventCount: 0, sourceType: 'AUTHORING', changeNote: 'Initial version', publishedAt: timestamp,
  } : null;
  return {
    id: uuid(number), code: `SCN-${String(number).padStart(5, '0')}`, name,
    description: 'Browser test scenario', category: number === 3 ? 'following' : 'free_driving',
    status: 'ACTIVE', originType: 'AUTHORING', hasDraft: !published, tags: number === 2 ? ['rain'] : [],
    createdAt: timestamp, updatedAt: timestamp, latestVersion, latestContent: published ? structuredClone(content) : null,
  };
}

/** A fresh HTTP backend per test. Unhandled API requests fail instead of reaching the real backend. */
class BrowserApi {
  requests: Request[] = [];
  unhandled: string[] = [];
  scenarios = new Map([
    scenario(1, 'Draft crossing', false), scenario(2, 'Rain crossing'), scenario(3, 'Highway braking'),
    ...Array.from({ length: 11 }, (_, index) => scenario(index + 4, `Library scenario ${index + 1}`)),
  ].map(item => [item.id, item]));
  drafts = new Map<string, TeamDraft>([[ids.draft, {
    scenarioId: ids.draft, rowVersion: 1, lastValidationReportId: null, baseVersionId: null,
    updatedAt: timestamp, content: structuredClone(content),
  }]]);
  campaigns = new Map<string, TeamCampaign>();
  validation: TeamValidation = {
    id: uuid(301), scenarioId: ids.draft, contentHash: 'validated-hash', isValid: true,
    stoppedAt: null, errors: [], warnings: [], schemaVersion: '1.0', validatorVersion: '1.0', createdAt: timestamp,
  };
  private failure?: { method: string; path: string; status: number; detail: string };

  constructor() {
    this.campaigns.set(ids.campaign, this.makeCampaign(ids.campaign, {
      name: 'Safety regression', scenarioVersionIds: [uuid(102), uuid(103)], strategy: 'proposed_failure_history',
    }));
    this.campaigns.set(ids.completed, {
      ...this.makeCampaign(ids.completed, { name: 'Completed campaign', scenarioVersionIds: [uuid(102)] }),
      status: 'Completed', progress: 100, passRate: 100, runCount: 1, startedAt: timestamp,
    });
  }

  failNext(method: string, path: string, status: number, detail: string) {
    this.failure = { method, path, status, detail };
  }

  ready(): TeamReadyVersion[] {
    return [...this.scenarios.values()].filter(item => item.status === 'ACTIVE' && item.latestVersion?.status === 'READY').map(item => {
      const version = item.latestVersion!;
      return {
        scenarioVersionId: version.id, scenarioId: item.id, scenarioCode: item.code, scenarioName: item.name,
        category: item.category, versionNumber: version.versionNumber, isLatestReady: true, contentHash: version.contentHash,
        mapName: version.mapName, weatherPreset: version.weatherPreset, eventTypes: version.eventTypes,
        eventCount: 0, actorCount: 1, npcVehicleCount: 0, pedestrianCount: 0, speedLimitKmh: 30,
        egoBlueprint: 'vehicle.tesla.model3', publishedAt: timestamp,
      };
    });
  }

  private makeCampaign(id: string, input: CampaignCreateInput): TeamCampaign {
    return {
      id, code: id === ids.completed ? 'CMP-00002' : id === ids.campaign ? 'CMP-00001' : 'CMP-00003',
      name: input.name, description: input.description ?? '', strategy: input.strategy ?? 'proposed_failure_history',
      status: 'Draft', progress: 0, passRate: 0, failedRuns: 0, estimatedDuration: '2 min',
      owner: 'Browser tester', createdAt: timestamp, startedAt: null, runCount: 0,
      sut: { type: input.sutType ?? 'behavior_agent', behavior: input.sutBehavior ?? 'normal', carlaVersion: input.sutCarlaVersion ?? '0.9.16' },
      scenarioVersionIds: input.scenarioVersionIds,
      scenarios: input.scenarioVersionIds.map((versionId, sortOrder) => {
        const item = this.ready().find(version => version.scenarioVersionId === versionId)!;
        return { ...item, sortOrder };
      }),
    };
  }

  private runs(campaign: TeamCampaign): TeamRun[] {
    if (!campaign.runCount) return [];
    return campaign.scenarios.map((item, index) => ({
      ...item, id: uuid(400 + index), campaignId: campaign.id, status: campaign.status === 'Completed' ? 'Completed' : 'Queued',
      verdict: campaign.status === 'Completed' ? 'PASS' : null, contentHash: 'run-hash', seed: 42,
      startedAt: campaign.startedAt, finishedAt: campaign.status === 'Completed' ? timestamp : null, errorMessage: null,
    }));
  }

  private paginate<T>(items: T[], params: URLSearchParams) {
    const page = Number(params.get('page') ?? 1), pageSize = Number(params.get('pageSize') ?? 12);
    return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: items.length, totalPages: Math.ceil(items.length / pageSize) };
  }

  async handle(route: Route) {
    const request = route.request(), url = new URL(request.url()), method = request.method(), path = url.pathname;
    const params = url.searchParams;
    this.requests.push(request);
    const reply = (json: unknown, status = 200) => route.fulfill({ status, json });
    if (this.failure?.method === method && this.failure.path === path) {
      const { status, detail } = this.failure;
      this.failure = undefined;
      return reply({ title: 'Request failed', detail, status }, status);
    }
    if (method === 'GET') {
      if (path === '/api/v1/auth/me') return reply({ id: uuid(900), displayName: 'Browser tester', email: 'browser@example.invalid', role: 'ADMIN', isActive: true });
      if (path === '/api/v1/reference/catalog') return reply({ schemaVersion: '1.0', categories: ['free_driving', 'following'], weatherPresets: ['ClearNoon', 'HardRainNoon'], eventTypes: ['lead_vehicle_brake'], triggerTypes: [], actorTypes: [] });
      if (path === '/api/v1/reference/scenario-schema') return reply(schema);
      if (path === '/api/v1/reference/maps') return reply(['Town01', 'Town02'].map(mapName => ({ mapName, carlaVersion: '0.9.16', spawnPointCount: 2, previewImagePath: null })));
      if (/^\/api\/v1\/reference\/maps\/Town0[12]$/.test(path)) return reply({ mapName: path.split('/').at(-1), carlaVersion: '0.9.16', spawnPointCount: 2, spawnPoints: [{ index: 0, x: 0, y: 0, z: 0, yaw: 0 }, { index: 1, x: 50, y: 0, z: 0, yaw: 0 }] });
      if (path === '/api/v1/reference/scenario-templates') return reply([{ key: 'lead_vehicle_brake', title: 'Lead vehicle braking', summary: 'A lead vehicle brakes ahead.', category: 'following', mapName: 'Town01', eventTypes: ['lead_vehicle_brake'], reference: null }]);
      if (path === '/api/v1/tags') return reply([{ name: 'rain', scenarioCount: 1, activeScenarioCount: 1 }]);
      if (path === '/api/v1/prioritization/strategies') return reply([{ id: 'proposed_failure_history', label: 'Failure history', description: 'Failure history strategy' }, { id: 'random', label: 'Random', description: 'Seeded random order' }]);
      if (path === '/api/v1/oracle-configs') return reply([]);
      if (path === '/api/v1/scenarios') {
        const items = [...this.scenarios.values()].filter(item =>
          (!params.get('q') || `${item.name} ${item.code}`.toLowerCase().includes(params.get('q')!.toLowerCase())) &&
          (!params.get('category') || item.category === params.get('category')) &&
          (!params.get('status') || item.status === params.get('status')) &&
          (!params.get('map') || item.latestVersion?.mapName === params.get('map')) &&
          (!params.get('weather') || item.latestVersion?.weatherPreset === params.get('weather')) &&
          (!params.has('hasDraft') || item.hasDraft === (params.get('hasDraft') === 'true')) &&
          params.getAll('tag').every(tag => item.tags?.includes(tag)));
        return reply(this.paginate(items.map(item => ({ ...item, latestVersionNumber: item.latestVersion?.versionNumber ?? 0, latestVersionStatus: item.latestVersion?.status ?? null, mapName: item.latestVersion?.mapName ?? null, weatherPreset: item.latestVersion?.weatherPreset ?? null, eventTypes: [] })), params));
      }
      if (['/api/v1/scenario-versions/ready', '/api/v1/campaigns/available-scenarios'].includes(path)) {
        return reply(this.paginate(this.ready().filter(item =>
          (!params.get('q') || `${item.scenarioName} ${item.scenarioCode}`.toLowerCase().includes(params.get('q')!.toLowerCase())) &&
          (!params.get('map') || item.mapName === params.get('map')) &&
          (!params.get('category') || item.category === params.get('category')) &&
          (!params.get('scenarioId') || item.scenarioId === params.get('scenarioId'))), params));
      }
      if (path === '/api/v1/campaigns') return reply([...this.campaigns.values()]);
    }

    if (method === 'POST' && path === '/api/v1/scenarios') {
      const input = request.postDataJSON();
      const item = { ...scenario(50, input.name, false), description: input.description, category: input.category };
      this.scenarios.set(item.id, item);
      this.drafts.set(item.id, { ...structuredClone(this.drafts.get(ids.draft)!), scenarioId: item.id });
      return reply(item, 201);
    }
    const scenarioMatch = path.match(/^\/api\/v1\/scenarios\/([^/]+)(.*)$/);
    if (scenarioMatch) {
      const [, id, suffix] = scenarioMatch, item = this.scenarios.get(id);
      if (item) {
        if (!suffix && method === 'GET') return reply(item);
        if (!suffix && method === 'PATCH') { Object.assign(item, request.postDataJSON()); return reply(item); }
        if (suffix === '/draft' && method === 'GET') return reply(this.drafts.get(id));
        if (suffix === '/draft' && method === 'PUT') {
          const saved = { ...this.drafts.get(id)!, rowVersion: this.drafts.get(id)!.rowVersion + 1, content: request.postDataJSON().content };
          this.drafts.set(id, saved); return reply(saved);
        }
        if (suffix === '/draft/validate' && method === 'POST') return reply({ ...this.validation, scenarioId: id });
        if (suffix === '/versions' && method === 'GET') return reply(item.latestVersion ? [item.latestVersion] : []);
        if (suffix === '/versions' && method === 'POST') {
          const version = { ...scenario(50, item.name).latestVersion!, changeNote: request.postDataJSON().changeNote };
          item.latestVersion = version; item.latestContent = this.drafts.get(id)!.content; item.hasDraft = false; this.drafts.delete(id);
          return reply({ summary: version, scenarioId: id, content: item.latestContent, schemaVersion: '1.0', validationReportId: this.validation.id });
        }
        if (suffix === '/imports' && method === 'GET') return reply([]);
        if (suffix === '/tags' && method === 'PUT') { item.tags = request.postDataJSON().tags; return reply({ scenarioId: id, tags: item.tags }); }
        if (['/archive', '/restore'].includes(suffix) && method === 'POST') { item.status = suffix === '/archive' ? 'ARCHIVED' : 'ACTIVE'; return reply(item); }
        if (suffix === '/draft/export' && method === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify(this.drafts.get(id)!.content) });
      }
    }
    if (path === '/api/v1/campaigns' && method === 'POST') {
      const item = this.makeCampaign(uuid(203), request.postDataJSON()); this.campaigns.set(item.id, item); return reply(item, 201);
    }
    const campaignMatch = path.match(/^\/api\/v1\/campaigns\/([^/]+)(.*)$/);
    if (campaignMatch) {
      const [, id, suffix] = campaignMatch, item = this.campaigns.get(id);
      if (item) {
        if (!suffix && method === 'GET') return reply(item);
        if (!suffix && method === 'PATCH') {
          const input = request.postDataJSON();
          const saved = { ...this.makeCampaign(id, { name: item.name, strategy: item.strategy, description: item.description, scenarioVersionIds: item.scenarioVersionIds, sutType: item.sut.type, sutBehavior: item.sut.behavior, sutCarlaVersion: item.sut.carlaVersion, ...input }), status: item.status, runCount: item.runCount };
          this.campaigns.set(id, saved); return reply(saved);
        }
        if (['/start', '/rerun'].includes(suffix) && method === 'POST') { item.status = 'Queued'; item.runCount = item.scenarioVersionIds.length; return reply(item); }
        if (suffix === '/runs' && method === 'GET') return reply(this.runs(item));
      }
    }
    if (/^\/api\/v1\/runs\/[^/]+\/result$/.test(path) && method === 'GET') {
      const campaign = [...this.campaigns.values()].find(item => item.runCount > 0)!;
      const run = this.runs(campaign).find(item => item.id === path.split('/')[4])!;
      return reply({ ...run, runId: run.id, campaignCode: campaign.code, campaignName: campaign.name, durationS: null, outcome: null, telemetryReceivedAt: null, hasVideo: false, infraRetryCount: 0, evaluations: [] });
    }
    this.unhandled.push(`${method} ${path}`);
    return reply({ title: 'Unhandled browser test API request', detail: `${method} ${path}` }, 501);
  }
}

type Fixtures = { backend: BrowserApi; workspace: Page; devRole: DevRole };
export const test = base.extend<Fixtures>({
  devRole: ['SCENARIO_ENGINEER', { option: true }],
  backend: async ({ page }, provide) => {
    const backend = new BrowserApi();
    await page.route('**/api/**', route => backend.handle(route));
    await provide(backend);
    expect(backend.unhandled, 'Every API request must be mocked; the real backend is never contacted').toEqual([]);
  },
  workspace: async ({ page, backend, devRole }, provide) => {
    void backend;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('asx-locale', 'en'));
    await page.goto('/');
    await page.getByLabel('Dev role', { exact: true }).selectOption(devRole);
    await page.getByRole('button', { name: 'Open development workspace', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await provide(page);
    expect(errors, 'No uncaught browser errors').toEqual([]);
  },
});
export { expect };
