import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// The real TypeScript adapter executes against an injected offline transport.
// Never contact the user's running backend, mutate a campaign, or launch CARLA.
globalThis.fetch = () => { throw new Error('Network access is forbidden in failure-analysis contracts.'); };
const source = await readFile(resolve('src/services/teamFailureAnalysis.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
await mkdir(resolve('node_modules/.tmp'), { recursive: true });
const output = resolve('node_modules/.tmp/failure-analysis-contract-under-test.mjs');
await writeFile(output, compiled);
const { failureAnalysisApi, failureActionAllowed } = await import(pathToFileURL(output).href);
const calls = [];
const campaignId = '3e17d79a-51dc-4f90-b3c1-06b8bde4ea73';
const runId = '3e77d79a-51dc-4f90-b3c1-06b8bde4ea73';
const response = {
  analysisId: 'persisted-analysis', campaignId, campaignCode: 'CMP-CONTRACT', campaignName: 'Offline contract',
  step: 'evaluated', runsJudged: 3, passCount: 1, failCount: 2, errorExcluded: 1, pendingCount: 0,
  summary: 'Original backend summary', reviewNote: 'Original reviewer note',
  features: [{ runId, sortOrder: 0, scenarioCode: 'SCN-CONTRACT', scenarioName: 'Original name', verdict: 'FAIL', outcome: 'STOPPED_ON_VIOLATION', durationS: 12.05, hasVideo: false, failingChecks: ['collision'], warningChecks: ['ttc'] }],
  faults: [{ rootScenarioId: 'original-root', rootScenarioCode: 'SCN-ROOT', rootScenarioName: 'Original root', check: 'collision', runIds: [runId], firstDetectedRunId: runId, firstT: 10.2, explanation: null, report: null, needsAdditionalVerification: true, status: 'unexplained', similarRunIds: [] }],
  effectiveness: {
    proposed: { label: 'proposed', apfd: null, apfdc: 0, curve: [] },
    reverseBaseline: { label: 'reverse', apfd: 0.25, apfdc: null, curve: [{ testsRun: 1, faultsFound: 0, fraction: 0 }] },
    randomBaseline: { label: 'random', apfd: 0.5, apfdc: 0.6, curve: [{ testsRun: 1, faultsFound: 1, fraction: 1 }] },
    apfdGainVsReverse: null,
  },
};
const video = new Blob(['offline-original-video-fixture'], { type: 'video/mp4' });
const client = {
  request: async (path, init) => { calls.push({ path, method: init?.method ?? 'GET', body: init?.body }); return response; },
  download: async (path, name) => { calls.push({ path, method: 'GET', download: name }); },
  media: async path => { calls.push({ path, method: 'GET', media: true }); return video; },
};
const api = failureAnalysisApi(client);
let assertions = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const base = `/api/v1/campaigns/${campaignId}/failure-analysis`;
const owned = new Set();
async function contract(name, invoke, method, path, body, isOwned = true) {
  const result = await invoke();
  equal(result, response, `${name}: preserve actual server response, including null metrics and evidence`);
  const call = calls.at(-1);
  equal(call.path, path, `${name}: path`);
  equal(call.method, method, `${name}: method`);
  equal(call.body === undefined ? undefined : JSON.parse(call.body), body, `${name}: JSON body`);
  if (isOwned) owned.add(`${method} ${path}`);
}
await contract('list actual campaigns', () => api.campaigns(), 'GET', '/api/v1/campaigns', undefined, false);
await contract('read saved analysis', () => api.get(campaignId), 'GET', base);
await contract('group faults', () => api.group(campaignId), 'POST', base);
await contract('verify grouping', () => api.verify(campaignId), 'POST', `${base}/verify`);
await contract('link similar failures', () => api.similar(campaignId), 'POST', `${base}/similar`);
await contract('check evidence explainability', () => api.explainability(campaignId), 'POST', `${base}/explainability`);
await contract('explicit return to execution', () => api.returnToFlow3(campaignId), 'POST', `${base}/return-to-flow3`);
await contract('generate persisted report', () => api.generate(campaignId), 'POST', `${base}/generate`);
await contract('review needs more', () => api.review(campaignId, 'needs_more', '  Original multiline\nnote  '), 'POST', `${base}/review`, { decision: 'needs_more', note: '  Original multiline\nnote  ' });
await contract('complete review', () => api.review(campaignId, 'complete', null), 'POST', `${base}/review`, { decision: 'complete', note: null });
await contract('omitted optional note', () => api.review(campaignId, 'complete'), 'POST', `${base}/review`, { decision: 'complete', note: null });
await contract('server effectiveness', () => api.evaluation(campaignId), 'GET', `${base}/evaluation`);
equal(owned.size, 9, 'all nine new method/route contracts are exercised');
equal(response.effectiveness.proposed.apfd, null, 'null APFD never becomes zero or a fabricated score');
equal(response.effectiveness.proposed.apfdc, 0, 'a real zero APFDc is retained');
equal(response.faults[0].explanation, null, 'missing evidence is not replaced with a generated client explanation');
await api.download(campaignId);
equal(calls.at(-1), { path: base, method: 'GET', download: `failure-analysis-${campaignId}.json` }, 'analysis export uses authenticated download of the saved backend response');
await api.download(campaignId, 'custom-report.json');
equal(calls.at(-1).download, 'custom-report.json', 'caller export filename is preserved');
await contract('original run evidence', () => api.runResult(runId), 'GET', `/api/v1/runs/${runId}/result`, undefined, false);
await api.downloadRun(runId);
equal(calls.at(-1), { path: `/api/v1/runs/${runId}/result`, method: 'GET', download: `oracle-${runId}.json` }, 'Oracle evidence remains linked to the actual run');
await api.downloadVideo(runId);
equal(calls.at(-1), { path: `/api/v1/runs/${runId}/video`, method: 'GET', download: `carla-${runId}.mp4` }, 'original MP4 uses authenticated download');
equal(await api.video(runId), video, 'video returns the original authenticated Blob');
equal(calls.at(-1), { path: `/api/v1/runs/${runId}/video`, method: 'GET', media: true }, 'video preview uses injected media transport');
equal(api.supportsVideo, true, 'media capability is exposed');
await api.get('unsafe /?#');
equal(calls.at(-1).path, '/api/v1/campaigns/unsafe%20%2F%3F%23/failure-analysis', 'campaign path segments cannot inject routes or query strings');
await api.runResult('unsafe /?#');
equal(calls.at(-1).path, '/api/v1/runs/unsafe%20%2F%3F%23/result', 'run path segments are encoded');
const unavailable = failureAnalysisApi({ request: client.request, download: client.download });
equal(unavailable.supportsVideo, false, 'missing authenticated media is represented explicitly');
await assert.rejects(unavailable.video(runId), /unavailable/); assertions += 1;
const denied = Object.assign(new Error('403 server policy denied'), { status: 403 });
const failing = failureAnalysisApi({ request: async () => { throw denied; }, download: client.download });
await assert.rejects(failing.verify(campaignId), reason => reason === denied); assertions += 1;
const absent = Object.assign(new Error('No analysis yet'), { status: 404 });
const missing = failureAnalysisApi({ request: async () => { throw absent; }, download: client.download });
await assert.rejects(missing.get(campaignId), reason => reason === absent); assertions += 1;

// Independent transition matrix from FailureAnalysisService/AnalysisSteps: stale
// analysis stages must not enable a different workflow mutation in the UI.
const actions = ['group', 'verify', 'similar', 'explainability', 'return-to-flow3', 'generate', 'review', 'evaluation'];
const matrix = {
  grouped: ['group', 'verify'], verified: ['group', 'similar'], similar_found: ['group', 'explainability'],
  unexplained: ['group', 'return-to-flow3'], awaiting_flow3: ['group'], explainable: ['group', 'generate'],
  report_draft: ['group', 'review'], needs_more: ['group', 'review'], evaluated: ['group', 'evaluation'],
  unknown: ['group'],
};
for (const [step, enabled] of Object.entries(matrix)) {
  for (const action of actions) equal(failureActionAllowed(action, step), enabled.includes(action), `${step}: ${action} matches backend gate`);
}
equal(failureActionAllowed('group', null), true, 'a missing analysis may be created');
equal(failureActionAllowed('review', null), false, 'a missing analysis cannot be reviewed');
equal(failureActionAllowed('return-to-flow3', 'evaluated'), false, 'a completed report cannot accidentally requeue runs');
equal(failureActionAllowed('evaluation', 'report_draft'), false, 'evaluation is unavailable before report completion');
console.log(`Failure analysis contracts: 9/9 HTTP operations, ${assertions} assertions passed; zero backend writes/network/CARLA calls.`);
console.log('ASX_COVERAGE:' + JSON.stringify(calls.map(call => `${call.method} ${call.path}`)));
