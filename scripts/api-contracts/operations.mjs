import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Only the exported contract helpers are executed. No backend or network is contacted.
globalThis.fetch = () => { throw new Error('Network access is forbidden in the contract harness.'); };
const source = await readFile(resolve('src/services/teamOperations.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const compiledPath = resolve('node_modules/.tmp/operations-contract-under-test.mjs');
await writeFile(compiledPath, compiled);
const { operationsApi } = await import(pathToFileURL(compiledPath).href);
const calls = [];
const response = { marker: 'unmodified transport response' };
const videoBlob = new Blob(['contract-fixture-only'], { type: 'video/mp4' });
const client = {
  request: async (path, init) => { calls.push({ kind: 'request', path, method: init?.method ?? 'GET', init }); return response; },
  download: async (path, fileName) => { calls.push({ kind: 'download', path, fileName, method: 'GET' }); },
  media: async path => { calls.push({ kind: 'media', path, method: 'GET' }); return videoBlob; },
};
const api = operationsApi(client);
const campaignId = '3e17d79a-51dc-4f90-b3c1-06b8bde4ea73';
const versionId = 'b218a93a-458e-44a8-ae5c-0be898fc6ad3';
const runId = '3e77d79a-51dc-4f90-b3c1-06b8bde4ea73';
let assertions = 0;
const equal = (actual, expected, message) => { assertions += 1; assert.deepEqual(actual, expected, message); };
const expectedEndpoints = new Set();
async function request(name, invoke, method, path, body) {
  const result = await invoke();
  const call = calls.at(-1);
  equal(call.kind, 'request', `${name} uses the injected request transport`);
  equal(call.method, method, `${name} HTTP method`);
  equal(call.path, path, `${name} route`);
  equal(result, response, `${name} returns the actual transport response`);
  equal(call.init?.body === undefined ? undefined : JSON.parse(call.init.body), body, `${name} request JSON`);
  expectedEndpoints.add(`${method} ${new URL(path, 'https://contract.invalid').pathname.replace(campaignId, '{campaignId}').replace(runId, '{runId}')}`);
}
await request('list campaigns', () => api.listCampaigns(), 'GET', '/api/v1/campaigns');
await request('campaign detail', () => api.getCampaign(campaignId), 'GET', `/api/v1/campaigns/${campaignId}`);
const create = { name: 'Contract-only campaign', description: 'No backend writes', strategy: 'diversity', scenarioVersionIds: [versionId], sutType: 'behavior_agent', sutBehavior: 'cautious', sutCarlaVersion: '0.9.16' };
await request('create campaign', () => api.createCampaign(create), 'POST', '/api/v1/campaigns', create);
const patch = { name: 'Updated', description: '', strategy: 'risk_first', scenarioVersionIds: [versionId], sutType: 'autopilot', sutBehavior: 'normal', sutCarlaVersion: '0.9.16' };
await request('patch all campaign fields', () => api.updateCampaign(campaignId, patch), 'PATCH', `/api/v1/campaigns/${campaignId}`, patch);
await request('start campaign', () => api.startCampaign(campaignId), 'POST', `/api/v1/campaigns/${campaignId}/start`);
await request('rerun campaign', () => api.rerunCampaign(campaignId), 'POST', `/api/v1/campaigns/${campaignId}/rerun`);
await request('campaign runs', () => api.listRuns(campaignId), 'GET', `/api/v1/campaigns/${campaignId}/runs`);
const readyQuery = { q: 'Rain & road', category: 'Cut in', map: 'Town10HD_Opt', scenarioId: versionId, latestOnly: false, page: 2, pageSize: 100 };
await api.availableReady(readyQuery);
const readyCall = calls.at(-1);
equal(readyCall.method, 'GET', 'available READY is read-only');
const readyUrl = new URL(readyCall.path, 'https://contract.invalid');
equal(readyUrl.pathname, '/api/v1/campaigns/available-scenarios', 'available READY route');
for (const [key, value] of Object.entries(readyQuery)) equal(readyUrl.searchParams.get(key), String(value), `READY query preserves ${key}`);
expectedEndpoints.add('GET /api/v1/campaigns/available-scenarios');
await api.availableReady({ q: '', category: undefined, latestOnly: false, page: 0 });
const sparseQuery = new URL(calls.at(-1).path, 'https://contract.invalid').searchParams;
equal([...sparseQuery.keys()], ['latestOnly', 'page'], 'query omits empty/undefined values and preserves false/zero');
equal(sparseQuery.get('latestOnly'), 'false', 'false is not removed from query');
equal(sparseQuery.get('page'), '0', 'numeric values pass through for backend validation');
await api.availableReady();
equal(calls.at(-1).path, '/api/v1/campaigns/available-scenarios', 'empty query has no trailing question mark');
await request('strategies', () => api.listStrategies(), 'GET', '/api/v1/prioritization/strategies');
const rank = { scenarioVersionIds: [versionId], strategy: 'proposed_failure_history', params: { riskWeight: 0.2, diversityWeight: 0.9, seed: -42, limit: 100 } };
await request('rank explicit versions', () => api.rank(rank), 'POST', '/api/v1/prioritization/rank', rank);
for (const strategy of ['proposed_failure_history', 'severity_first', 'risk_first', 'diversity', 'random_baseline']) {
  const body = { scenarioVersionIds: [], strategy, params: { limit: 13, riskWeight: 0, diversityWeight: 0, seed: 0 } };
  await api.rank(body);
  equal(JSON.parse(calls.at(-1).init.body), body, `rank preserves auto READY selection and parameters for ${strategy}`);
}
await request('oracle configs', () => api.listOracleConfigs(), 'GET', '/api/v1/oracle-configs');
await request('run result', () => api.getRunResult(runId), 'GET', `/api/v1/runs/${runId}/result`);
await api.downloadRunResult(runId);
equal(calls.at(-1), { kind: 'download', method: 'GET', path: `/api/v1/runs/${runId}/result`, fileName: `oracle-${runId}.json` }, 'JSON evidence uses injected authenticated download');
await api.downloadVideo(runId);
equal(calls.at(-1), { kind: 'download', method: 'GET', path: `/api/v1/runs/${runId}/video`, fileName: `carla-${runId}.mp4` }, 'video evidence uses injected authenticated download');
await api.downloadVideo(runId, 'custom.mp4');
equal(calls.at(-1).fileName, 'custom.mp4', 'custom artifact filename is retained');
equal(api.supportsVideoMedia, true, 'authenticated media capability is exposed');
const media = await api.videoMedia(runId);
equal(media, videoBlob, 'authenticated video Blob is returned unchanged');
equal(calls.at(-1), { kind: 'media', path: `/api/v1/runs/${runId}/video`, method: 'GET' }, 'video preview uses injected authenticated media, never raw fetch');
expectedEndpoints.add('GET /api/v1/runs/{runId}/video');
const metadataOnly = { description: null, sutType: 'autopilot', sutBehavior: 'aggressive', sutCarlaVersion: 'custom-version' };
await api.updateCampaign(campaignId, metadataOnly);
equal(JSON.parse(calls.at(-1).init.body), metadataOnly, 'metadata-only PATCH preserves nullable description and all SUT fields');
equal(Object.hasOwn(JSON.parse(calls.at(-1).init.body), 'scenarioVersionIds'), false, 'metadata-only PATCH leaves locked scenario order untouched');
await api.getCampaign('unsafe /?#');
equal(calls.at(-1).path, '/api/v1/campaigns/unsafe%20%2F%3F%23', 'path identifiers are URI encoded');
const unavailable = operationsApi({ request: client.request, download: client.download });
equal(unavailable.supportsVideoMedia, false, 'missing media capability is represented honestly');
await assert.rejects(unavailable.videoMedia(runId), /unavailable/); assertions += 1;
const failed = new Error('Contract fixture transport failure');
const failing = operationsApi({ request: async () => { throw failed; }, download: client.download });
await assert.rejects(failing.getRunResult(runId), reason => reason === failed); assertions += 1;
equal(expectedEndpoints.size, 13, 'all 13 owned HTTP method/route contracts are exercised');
equal(create.scenarioVersionIds, [versionId], 'factory does not mutate caller campaign data');
console.log(`Operations contracts: ${expectedEndpoints.size}/13 endpoint contracts passed; ${assertions} assertions passed; zero backend/network calls.`);
console.log('ASX_COVERAGE:' + JSON.stringify(calls.map(call => `${call.method} ${call.path}`)));
for (const endpoint of [...expectedEndpoints].sort()) console.log(`  ${endpoint}`);
