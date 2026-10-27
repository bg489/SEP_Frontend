import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const originalFetch = globalThis.fetch;
let networkCalls = 0;
globalThis.fetch = () => { networkCalls++; throw new Error('This harness forbids network requests.'); };
try {
  const { TeamScenarioService } = await server.ssrLoadModule('/src/services/teamScenarios.ts');
  const calls = [];
  const content = { schema_version: '1.0', extensions: { future: { retained: true } } };
  const draft = { scenarioId: 'scenario-id', rowVersion: 18, content, baseVersionId: null, lastValidationReportId: null };
  const client = {
    async request(path, init = {}) {
      calls.push({ path, init, method: init.method ?? 'GET' });
      if (path.endsWith('/draft')) return draft;
      return {};
    },
    async download(path, fileName) { calls.push({ path, fileName, method: 'GET' }); },
  };
  const service = new TeamScenarioService(client);
  const id = 'scenario-id';
  await service.catalog();
  await service.maps();
  await service.schema();
  await service.search({ q: 'name & code', category: 'cut_in', status: 'ARCHIVED', map: 'Town03', hasDraft: false, page: 3, pageSize: 24 });
  const query = new URL(calls.at(-1).path, 'https://fixture.invalid').searchParams;
  assert.deepEqual(Object.fromEntries(query), { q: 'name & code', category: 'cut_in', status: 'ARCHIVED', map: 'Town03', hasDraft: 'false', page: '3', pageSize: '24' });
  await service.detail(id);
  await service.createProfile('Scenario', 'Description', 'cut_in');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { name: 'Scenario', description: 'Description', category: 'cut_in' });
  await service.updateProfile(id, { description: '' });
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { description: '' });
  await service.draft(id);
  await service.createDraft(id, 4);
  assert.equal(calls.at(-1).path, `/api/v1/scenarios/${id}/draft?fromVersion=4`);
  await service.saveDraft(id, content, 18);
  assert.equal(calls.at(-1).init.headers['If-Match'], '"18"');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { content });
  assert.equal(JSON.parse(calls.at(-1).init.body).content.extensions.future.retained, true);
  await service.discardDraft(id);
  await service.validate(id);
  await service.publish(id, 'Reviewed warnings');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { changeNote: 'Reviewed warnings' });
  await service.versions(id);
  await service.version(id, 4);
  await service.diff(id, 2, 4);
  assert.equal(calls.at(-1).path, `/api/v1/scenarios/${id}/versions/diff?from=2&to=4`);
  await service.deprecate(id, 2);
  await service.archive(id);
  await service.restore(id);
  await service.clone(id, 'Clone', 'Override', 2);
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { name: 'Clone', description: 'Override', versionNumber: 2 });
  await service.imports(id);
  const file = new File(['{}'], 'extensionless');
  await service.importFile(file, 'Imported', 'braking', 'yaml');
  assert.ok(calls.at(-1).init.body instanceof FormData);
  assert.equal(calls.at(-1).init.body.get('File').name, 'extensionless');
  assert.equal(calls.at(-1).init.body.get('Name'), 'Imported');
  assert.equal(calls.at(-1).init.body.get('Category'), 'braking');
  assert.equal(calls.at(-1).init.body.get('Format'), 'yaml');
  await service.exportDraft(id, 'yaml');
  assert.equal(calls.at(-1).fileName, `${id}-draft.yaml`);
  await service.exportVersion(id, 4, 'json');
  assert.equal(calls.at(-1).fileName, `${id}-v4.json`);
  await service.variants(id, 4);
  await service.variantBatch(id, 4, 'batch-id');
  await service.generateVariants(id, 4, { npc_count: [5, 10] }, 'Grid prefix', 'Review note');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { parameterGrid: { npc_count: [5, 10] }, namePrefix: 'Grid prefix', note: 'Review note' });
  await service.ready({ q: 'Ready', category: 'cut_in', map: 'Town03', scenarioId: id, latestOnly: false, page: 2, pageSize: 24 });
  assert.deepEqual(Object.fromEntries(new URL(calls.at(-1).path, 'https://fixture.invalid').searchParams), { pageSize: '24', latestOnly: 'false', q: 'Ready', category: 'cut_in', map: 'Town03', scenarioId: id, page: '2' });
  await service.executionPackage('version-id');

  const operations = calls.map(call => `${call.method} ${call.path.split('?')[0]}`);
  const expected = [
    'GET /api/v1/reference/catalog', 'GET /api/v1/reference/maps', 'GET /api/v1/reference/scenario-schema',
    'GET /api/v1/scenarios', `GET /api/v1/scenarios/${id}`, 'POST /api/v1/scenarios', `PATCH /api/v1/scenarios/${id}`,
    `GET /api/v1/scenarios/${id}/draft`, `POST /api/v1/scenarios/${id}/draft`, `PUT /api/v1/scenarios/${id}/draft`, `DELETE /api/v1/scenarios/${id}/draft`,
    `POST /api/v1/scenarios/${id}/draft/validate`, `POST /api/v1/scenarios/${id}/versions`, `GET /api/v1/scenarios/${id}/versions`,
    `GET /api/v1/scenarios/${id}/versions/4`, `GET /api/v1/scenarios/${id}/versions/diff`, `POST /api/v1/scenarios/${id}/versions/2/deprecate`,
    `POST /api/v1/scenarios/${id}/archive`, `POST /api/v1/scenarios/${id}/restore`, `POST /api/v1/scenarios/${id}/clone`,
    `GET /api/v1/scenarios/${id}/imports`, 'POST /api/v1/scenarios/import',
    `GET /api/v1/scenarios/${id}/draft/export`, `GET /api/v1/scenarios/${id}/versions/4/export`,
    `GET /api/v1/scenarios/${id}/versions/4/variant-batches`, `GET /api/v1/scenarios/${id}/versions/4/variant-batches/batch-id`, `POST /api/v1/scenarios/${id}/versions/4/variant-batches`,
    'GET /api/v1/scenario-versions/ready', 'GET /api/v1/scenario-versions/version-id/execution-package',
  ];
  assert.deepEqual(operations, expected);
  assert.equal(new Set(operations).size, 29);

  const conflict = new Error('409: CONCURRENCY_CONFLICT');
  const failing = new TeamScenarioService({ ...client, request: async () => { throw conflict; } });
  await assert.rejects(failing.saveDraft(id, content, 17), error => error === conflict);
  assert.deepEqual(content.extensions, { future: { retained: true } });
  assert.equal(networkCalls, 0);
  console.log('ASX_COVERAGE:' + JSON.stringify(calls.map(call => `${call.method} ${call.path}`)));
  console.log('PASS: 29 Flow1 HTTP operations; full scenario/READY query filters; quoted If-Match; canonical JSON preservation; import Format/Category; clone version/description; variant prefix/note; download paths; concurrency error propagation. Network requests: 0.');
} finally {
  globalThis.fetch = originalFetch;
  await server.close();
}
