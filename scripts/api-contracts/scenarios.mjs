import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { readFileSync } from 'node:fs';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
const originalFetch = globalThis.fetch;
let networkCalls = 0;
globalThis.fetch = () => { networkCalls++; throw new Error('This harness forbids network requests.'); };
try {
  const { TeamScenarioService, teamScenarioFromDetail } = await server.ssrLoadModule('/src/services/teamScenarios.ts');
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
  await service.templates();
  await service.tags();
  await service.replaceTags(id, ['rain', 'night']);
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { tags: ['rain', 'night'] });
  await service.history(id, 2, 50);
  assert.equal(calls.at(-1).path, `/api/v1/scenarios/${id}/history?page=2&pageSize=50`);
  await service.search({ q: 'name & code', category: 'cut_in', status: 'ARCHIVED', map: 'Town03', weather: 'WetNoon', eventType: 'vehicle_crossing', tag: ['rain', 'night'], hasDraft: false, page: 3, pageSize: 24 });
  const query = new URL(calls.at(-1).path, 'https://fixture.invalid').searchParams;
  assert.deepEqual(query.getAll('tag'), ['rain', 'night']);
  query.delete('tag');
  assert.deepEqual(Object.fromEntries(query), { q: 'name & code', category: 'cut_in', status: 'ARCHIVED', map: 'Town03', weather: 'WetNoon', eventType: 'vehicle_crossing', hasDraft: 'false', page: '3', pageSize: '24' });
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
  await service.generateVariants(id, 4, { npc_count: [5, 10], 'weather.preset': ['ClearNoon', 'ClearNight'] }, 'Grid prefix', 'Review note', 'pairwise');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { parameterGrid: { npc_count: [5, 10], 'weather.preset': ['ClearNoon', 'ClearNight'] }, namePrefix: 'Grid prefix', note: 'Review note', strategy: 'pairwise' });
  await service.ready({ q: 'Ready', category: 'cut_in', map: 'Town03', scenarioId: id, latestOnly: false, page: 2, pageSize: 24 });
  assert.deepEqual(Object.fromEntries(new URL(calls.at(-1).path, 'https://fixture.invalid').searchParams), { pageSize: '24', latestOnly: 'false', q: 'Ready', category: 'cut_in', map: 'Town03', scenarioId: id, page: '2' });
  await service.executionPackage('version-id');

  const operations = calls.map(call => `${call.method} ${call.path.split('?')[0]}`);
  const expected = [
    'GET /api/v1/reference/catalog', 'GET /api/v1/reference/maps', 'GET /api/v1/reference/scenario-schema',
    'GET /api/v1/reference/scenario-templates', 'GET /api/v1/tags', `PUT /api/v1/scenarios/${id}/tags`, `GET /api/v1/scenarios/${id}/history`,
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
  assert.equal(new Set(operations).size, 33);

  await service.createProfile('Template scenario', 'Description', 'pedestrian', 'pedestrian_crossing_ahead');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { name: 'Template scenario', description: 'Description', category: 'pedestrian', template: 'pedestrian_crossing_ahead' });
  await service.replaceTags(id, []);
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { tags: [] });
  const mapped = teamScenarioFromDetail({ id, name: 'Tagged', category: 'pedestrian', status: 'ACTIVE', tags: ['repository-tag'], latestContent: { metadata: { tags: ['old-published-tag'] } } });
  assert.deepEqual(mapped.tags, ['repository-tag']);

  const helpers = await server.ssrLoadModule('/src/services/teamSchemaEditor.ts');
  const schema = JSON.parse(readFileSync(new URL('./fixtures/scenario-schema-20261028.json', import.meta.url), 'utf8'));
  const defs = schema.$defs;
  const source = { metadata: { name: 'Original' }, actors: [{ id: 'ped_1', type: 'pedestrian', blueprint: 'walker.pedestrian.0001' }, { id: 'car_1', type: 'vehicle', blueprint: 'vehicle.audi.a2' }], events: [{ id: 'cross_1', type: 'pedestrian_crossing', actor_ref: 'ped_1', trigger: { type: 'simulation_time', time_s: 2 }, params: { speed_ms: 1.4, direction: 'left_to_right' } }], parameters: { speed: { type: 'number', value: 20, min: 10, max: 40 } }, extensions: { future: { retained: true } } };
  const copy = structuredClone(source);
  const vehicleCrossing = helpers.schemaChangeType(source, ['events', 0, 'type'], 'vehicle_crossing', defs);
  assert.equal(vehicleCrossing.events[0].actor_ref, 'car_1');
  assert.deepEqual(vehicleCrossing.events[0].params, { destination: { spawn_point_index: 0 }, speed_kmh: 5 });
  assert.equal(vehicleCrossing.events[0].params.direction, undefined);
  const lights = helpers.schemaChangeType(source, ['events', 0, 'type'], 'traffic_light_override', defs);
  assert.equal(lights.events[0].actor_ref, undefined);
  assert.deepEqual(lights.events[0].params, { state: 'red', duration_s: 1 });
  assert.deepEqual(source, copy, 'Action switching must not mutate the original draft');
  const changed = helpers.schemaUpdate(source, ['ego_vehicle', 'target_speed_kmh'], { $param: 'speed' });
  assert.deepEqual(changed.ego_vehicle.target_speed_kmh, { $param: 'speed' });
  assert.deepEqual(changed.extensions, source.extensions);
  assert.deepEqual(changed.events, source.events);
  const withoutEvent = helpers.schemaUpdate(source, ['events', 0], undefined);
  assert.deepEqual(withoutEvent.events, []);
  assert.equal(source.events.length, 1);
  const chained = helpers.schemaInitial(defs.trigger.oneOf.find(item => item.properties.type.const === 'after_event'), defs);
  assert.deepEqual(chained, { type: 'after_event', event_ref: '', delay_s: 0 });
  assert.equal(helpers.schemaBranch(defs.trigger, { type: 'time_to_collision', actor_ref: 'ped_1', ttc_s: 2 }, defs), 4);
  const lightSchema = helpers.conditionalSchema(defs.event, { type: 'traffic_light_override' }, defs);
  assert.equal(lightSchema.properties.actor_ref, undefined);
  const crossingSchema = helpers.resolveSchema(helpers.conditionalSchema(defs.event, { type: 'vehicle_crossing' }, defs).properties.params, defs);
  assert.ok(crossingSchema.properties.destination);
  assert.ok(crossingSchema.properties.sync);
  assert.ok(defs.paramsPedestrianCrossing.properties.sync.properties.offset_s.oneOf);
  assert.ok(defs.paramsLeadVehicleBrake.properties.time_gap_s.oneOf);
  assert.deepEqual(helpers.parameterRangeValues({ type: 'number', min: 0.3, max: 0.5, step: 0.1 }), [0.3, 0.4, 0.5]);
  assert.deepEqual(helpers.parameterRangeValues({ type: 'integer', min: 1, max: 3 }), [1, 2, 3]);
  assert.throws(() => helpers.parameterRangeValues({ min: 0, max: 10000, step: 0.01 }), /more than/);

  const conflict = new Error('409: CONCURRENCY_CONFLICT');
  const failing = new TeamScenarioService({ ...client, request: async () => { throw conflict; } });
  await assert.rejects(failing.saveDraft(id, content, 17), error => error === conflict);
  assert.deepEqual(content.extensions, { future: { retained: true } });
  assert.equal(networkCalls, 0);
  console.log('ASX_COVERAGE:' + JSON.stringify(calls.map(call => `${call.method} ${call.path}`)));
  console.log('PASS: 33 Flow1 HTTP operations; templates, tags and paged history; all filters with repeated tags; pairwise/weather grids; schema-driven event changes, chain/TTC/sync fields and parameter references; quoted If-Match and JSON preservation. Network requests: 0.');
} finally {
  globalThis.fetch = originalFetch;
  await server.close();
}
