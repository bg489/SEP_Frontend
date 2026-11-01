import type { Page, Request, Route } from '@playwright/test';
import type { RankResult, RunResult, TeamCampaign, TeamRun } from '../../src/services/teamOperations';
import type { TeamReadyVersion } from '../../src/services/teamContracts';
import { test as base, expect, ids } from './fixtures';

export const timestamp = '2026-10-28T08:00:00Z';
const uuid = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
export const runIds = { rain: uuid(501), highway: uuid(502), completed: uuid(503) };
export const rankPath = '/api/v1/prioritization/rank';
export const resultPath = (id: string) => `/api/v1/runs/${id}/result`;
export const videoPath = (id: string) => `/api/v1/runs/${id}/video`;
export const queuedNotice = /Runs queued in the database/;

// Deliberately header-only: exercises raw MP4 transport and the player's codec error,
// without presenting a synthetic file as a real CARLA recording.
export const mp4 = Buffer.from('000000186674797069736f6d0000020069736f6d69736f32', 'hex');

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

type Hold = {
  method: string; path: string;
  received: ReturnType<typeof deferred<Request>>;
  proceed: ReturnType<typeof deferred<void>>;
};

/** Adds operation-specific responses over the existing isolated browser backend. */
class OperationsApi {
  requests: Request[] = [];
  runLists = new Map<string, TeamRun[]>();
  results = new Map<string, Partial<RunResult>>();
  private holds: Hold[] = [];
  private failures: { method: string; path: string; status: number; detail: string }[] = [];
  private aborts: { method: string; path: string }[] = [];

  constructor(private page: Page, private campaigns: Map<string, TeamCampaign>, private ready: TeamReadyVersion[]) {}

  holdNext(method: string, path: string) {
    const hold: Hold = { method, path, received: deferred<Request>(), proceed: deferred<void>() };
    this.holds.push(hold);
    return {
      received: hold.received.promise,
      release: async () => {
        const request = await hold.received.promise;
        const response = this.page.waitForResponse(response => response.request() === request);
        hold.proceed.resolve();
        await (await response).finished();
        // Let fetch/Redux/React consume the released response before negative assertions.
        await this.page.evaluate(() => new Promise<void>(resolve => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }));
      },
    };
  }

  releaseAll() { this.holds.forEach(hold => hold.proceed.resolve()); }
  failNext(method: string, path: string, status: number, detail: string) {
    this.failures.push({ method, path, status, detail });
  }
  abortNext(method: string, path: string) { this.aborts.push({ method, path }); }
  matching(method: string, path: string) {
    return this.requests.filter(request => request.method() === method && new URL(request.url()).pathname === path);
  }

  runs(campaignId: string): TeamRun[] {
    const campaign = this.campaigns.get(campaignId)!;
    if (this.runLists.has(campaignId)) return this.runLists.get(campaignId)!;
    if (!campaign.runCount) return [];
    return campaign.scenarios.map((scenario, index) => ({
      ...scenario, id: campaignId === ids.completed ? runIds.completed : index === 0 ? runIds.rain : runIds.highway,
      campaignId, status: campaign.status === 'Completed' ? 'Completed' : 'Queued',
      verdict: campaign.status === 'Completed' ? 'PASS' : null,
      contentHash: `run-hash-${scenario.scenarioVersionId}`, seed: 42,
      startedAt: campaign.startedAt, finishedAt: campaign.status === 'Completed' ? timestamp : null, errorMessage: null,
    }));
  }

  queue() {
    Object.assign(this.campaigns.get(ids.campaign)!, { status: 'Queued', runCount: 2 });
  }

  result(runId: string): RunResult {
    const run = [...this.campaigns.keys()].flatMap(id => this.runs(id)).find(run => run.id === runId)!;
    const campaign = this.campaigns.get(run.campaignId)!;
    return {
      ...run, runId: run.id, campaignCode: campaign.code, campaignName: campaign.name,
      durationS: run.status === 'Completed' ? 12.5 : null,
      outcome: run.status === 'Completed' ? 'COMPLETED' : null,
      telemetryReceivedAt: run.status === 'Completed' ? timestamp : null,
      hasVideo: false, infraRetryCount: 0, evaluations: [], ...this.results.get(runId),
    };
  }

  private ranking(input: { scenarioVersionIds: string[]; strategy: string; params: { limit: number } }): RankResult {
    const versions = input.scenarioVersionIds.length
      ? input.scenarioVersionIds.map(id => this.ready.find(version => version.scenarioVersionId === id)!)
      : this.ready.slice(0, input.params.limit);
    return {
      runId: uuid(601), strategy: input.strategy, createdAt: timestamp,
      metrics: { apfdEstimate: 0.825, apfdcEstimate: 0.75, faultsFoundEarlyEstimate: 3,
        faultsTotalEstimate: 4, estimatedSuiteMinutes: 2.5, note: 'Content-based heuristic estimates only.' },
      ordered: [...versions].reverse().map((version, index) => ({
        ...version, rank: index + 1, severity: 'High', failureSignalEstimate: 2,
        score: 0.9 - index * 0.1, rationale: `Risk evidence for ${version.scenarioCode}`, estimatedCostMinutes: 1.25,
      })),
      featureNames: ['risk', 'cost'], distanceMatrix: versions.map((_, row) => versions.map((_, col) => row === col ? 0 : 0.5)),
    };
  }

  async handle(route: Route) {
    const request = route.request(), method = request.method(), path = new URL(request.url()).pathname;
    this.requests.push(request);
    const hold = this.holds.find(item => item.method === method && item.path === path);
    if (hold) {
      // Consume once, but keep the gate available to fixture cleanup if an assertion fails.
      hold.path = '';
      hold.received.resolve(request);
      await hold.proceed.promise;
    }
    const failureIndex = this.failures.findIndex(item => item.method === method && item.path === path);
    if (failureIndex >= 0) {
      const { status, detail } = this.failures.splice(failureIndex, 1)[0];
      return route.fulfill({ status, json: { title: 'Operation failed', detail, status } });
    }
    const abortIndex = this.aborts.findIndex(item => item.method === method && item.path === path);
    if (abortIndex >= 0) { this.aborts.splice(abortIndex, 1); return route.abort('failed'); }
    if (method === 'POST' && path === rankPath) return route.fulfill({ json: this.ranking(request.postDataJSON()) });
    const runs = path.match(/^\/api\/v1\/campaigns\/([^/]+)\/runs$/);
    if (method === 'GET' && runs) return route.fulfill({ json: this.runs(runs[1]) });
    const result = path.match(/^\/api\/v1\/runs\/([^/]+)\/result$/);
    if (method === 'GET' && result) return route.fulfill({ json: this.result(result[1]) });
    const video = path.match(/^\/api\/v1\/runs\/([^/]+)\/video$/);
    if (video && method === 'GET') return route.fulfill({ contentType: 'video/mp4', body: mp4 });
    if (video && method === 'PUT') {
      this.results.set(video[1], { ...this.results.get(video[1]), hasVideo: true });
      return route.fulfill({ status: 204 });
    }
    return route.fallback();
  }
}

export const test = base.extend<{ operations: OperationsApi }>({
  operations: [async ({ page, backend }, provide) => {
    const operations = new OperationsApi(page, backend.campaigns, backend.ready());
    const handler = (route: Route) => operations.handle(route);
    await page.route('**/api/**', handler);
    try { await provide(operations); }
    finally { operations.releaseAll(); await page.unroute('**/api/**', handler); }
  }, { auto: true }],
});

export async function openSection(page: Page, name: string) {
  await page.locator('aside').getByRole('button', { name, exact: true }).click();
}

export function campaignRow(page: Page, name = 'Safety regression') {
  return page.getByRole('row').filter({ has: page.getByRole('button', { name, exact: true }) });
}

export async function openQueue(page: Page) {
  await openSection(page, 'Execution queue');
  await expect(page.getByRole('heading', { name: 'Scenario runs', exact: true })).toBeVisible();
}

export function resultPanel(page: Page) {
  return page.locator('section.ops-panel').filter({ hasText: 'ACTUAL BACKEND RESULT' });
}

export { expect, ids };
