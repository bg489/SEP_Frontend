import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Only pure helpers and the injected API factory run here; network and database writes are forbidden.
globalThis.fetch = () => { throw new Error('Network access is forbidden in the reference contract harness.'); };
await mkdir(resolve('node_modules/.tmp'), { recursive: true });
async function load(name) {
  const source = await readFile(resolve(`src/services/${name}.ts`), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const path = resolve(`node_modules/.tmp/${name}-contract-under-test.mjs`);
  await writeFile(path, compiled);
  return import(pathToFileURL(path).href);
}
const { referenceApi, coverageAxis, coverageValues, coverageCellKey, coverageMatrix, NO_COVERAGE_EVENT } = await load('teamReferenceData');
const { mapLocation, mapNumber, mapTargets, buildMapScene, fitMapBox, zoomMapBox, relativeMapPosition } = await load('teamMapGeometry');
let assertions = 0;
const equal = (actual, expected, message) => { assertions++; assert.deepEqual(actual, expected, message); };
const calls = [], response = Object.freeze({ marker: 'original response returned by the injected Saga transport' });
const client = { request: async (path, init) => { calls.push({ path, method: init?.method ?? 'GET' }); return response; }, download: async () => {} };
const api = referenceApi(client);
async function get(name, invoke, expected) {
  equal(await invoke(), response, `${name} preserves backend response identity`);
  equal(calls.at(-1), { path: expected, method: 'GET' }, `${name} uses its exact read-only contract`);
}
await get('map catalogue', () => api.maps(), '/api/v1/reference/maps');
await get('map detail', () => api.map('Town10HD_Opt'), '/api/v1/reference/maps/Town10HD_Opt');
await get('encoded map detail', () => api.map('Town /?&雪'), '/api/v1/reference/maps/Town%20%2F%3F%26%E9%9B%AA');
await get('catalogue', () => api.catalog(), '/api/v1/reference/catalog');
await get('templates', () => api.templates(), '/api/v1/reference/scenario-templates');
await get('schema', () => api.schema(), '/api/v1/reference/scenario-schema');
await get('coverage default', () => api.coverage(), '/api/v1/coverage?scope=latest');
await get('coverage latest', () => api.coverage('latest'), '/api/v1/coverage?scope=latest');
await get('coverage all', () => api.coverage('all'), '/api/v1/coverage?scope=all');
await get('database health', () => api.health(), '/api/health/db');
const unavailable = new Error('Backend unavailable (fixture)');
const failing = referenceApi({ ...client, request: async () => { throw unavailable; } });
for (const invoke of [() => failing.maps(), () => failing.map('Unknown'), () => failing.templates(), () => failing.catalog(), () => failing.schema(), () => failing.coverage(), () => failing.health()]) {
  assertions++; await assert.rejects(invoke, reason => reason === unavailable);
}
for (const health of [{ status: 'OK', missingTables: [], postgres: '18.0' }, { status: 'SCHEMA_MISMATCH', missingTables: ['asx.scenario_version'], postgres: '18.0' }, { status: 'SCHEMA_MISMATCH', asxTables: 21, expectedTables: 18, postgres: '18.0' }]) {
  const returned = await referenceApi({ ...client, request: async () => health }).health();
  equal(returned, health, 'new and legacy health responses stay unmodified; missing table names are not fabricated');
}

const makeItem = (id, changes = {}) => ({ scenarioId: id, code: `SCN-${id}`, name: `Scenario ${id}`, scenarioVersionId: `${id}-v1`, versionNumber: 1,
  isLatestReady: true, category: 'pedestrian', mapName: 'Town10HD_Opt', weatherPreset: 'ClearNoon', eventTypes: ['pedestrian_crossing'], ...changes });
const coverage = { scope: 'all', scenarioCount: 3, versionCount: 4,
  axes: { maps: ['Town10HD_Opt', 'Town02'], weatherPresets: ['ClearNoon', 'WetNoon'], categories: ['pedestrian', 'other'], eventTypes: ['pedestrian_crossing', 'vehicle_crossing', 'lead_vehicle_brake'] },
  items: [makeItem('a'), makeItem('a', { scenarioVersionId: 'a-v2', versionNumber: 2, eventTypes: ['pedestrian_crossing', 'vehicle_crossing', 'vehicle_crossing'] }),
    makeItem('b', { mapName: 'Town02', weatherPreset: 'WetNoon', category: 'other', eventTypes: [] }),
    makeItem('c', { mapName: null, weatherPreset: null, category: 'other', eventTypes: ['new_backend_event'] })] };
const frozenBefore = JSON.stringify(coverage);
equal(coverageAxis(coverage, 'map'), ['Town10HD_Opt', 'Town02', '—'], 'catalogue order and unknown map value stay inspectable');
equal(coverageAxis(coverage, 'weather'), ['ClearNoon', 'WetNoon', '—'], 'null weather forms an inspectable cell');
equal(coverageAxis(coverage, 'event'), ['pedestrian_crossing', 'vehicle_crossing', 'lead_vehicle_brake', NO_COVERAGE_EVENT, 'new_backend_event'], 'unused catalogue events and no-event gap are retained');
equal(coverageValues(coverage.items[1], 'event'), ['pedestrian_crossing', 'vehicle_crossing'], 'duplicate event names do not double count a version');
equal(coverageValues(coverage.items[2], 'event'), [NO_COVERAGE_EVENT], 'event-free scenario has explicit membership');
const matrix = coverageMatrix(coverage, 'map', 'weather');
equal(matrix.cells.get(coverageCellKey('Town10HD_Opt', 'ClearNoon')).map(item => item.scenarioVersionId), ['a-v1', 'a-v2'], 'all READY scope keeps two versions of one scenario distinct');
equal(matrix.cells.get(coverageCellKey('Town10HD_Opt', 'WetNoon')), undefined, 'unrepresented catalogue combinations remain empty');
equal(matrix.covered, 3, 'covered combinations count occupied cells');
equal(matrix.combinations, 9, 'denominator includes known gaps and observed empty metadata');
equal(matrix.ratio, 1 / 3, 'coverage is derived from occupied combinations, not backend test-pass data');
const eventMatrix = coverageMatrix(coverage, 'category', 'event');
equal(eventMatrix.cells.get(coverageCellKey('pedestrian', 'vehicle_crossing')).length, 1, 'multi-event version contributes once to the crossing cell');
equal(eventMatrix.cells.get(coverageCellKey('other', NO_COVERAGE_EVENT)).length, 1, 'no-event versions are selectable');
equal(JSON.stringify(coverage), frozenBefore, 'building axes and matrices never mutates API data');
const empty = coverageMatrix({ ...coverage, items: [], axes: { maps: [], weatherPresets: [], categories: [], eventTypes: [] } }, 'map', 'weather');
equal([empty.covered, empty.combinations, empty.ratio], [0, 0, 0], 'empty metadata cannot produce NaN or infinity');
equal(coverageCellKey('a\u0000b', 'c'), coverageCellKey('a\u0000b', 'c'), 'cell keys support arbitrary strings deterministically');
assertions++; assert.notEqual(coverageCellKey('a\u0000b', 'c'), coverageCellKey('a', 'b\u0000c'), 'cell keys cannot collide when values contain delimiters');

const points = [
  { index: 0, x: 0, y: 0, z: 0.6, yaw: 0 }, { index: 10, x: 30, y: 0, z: 0.6, yaw: 0 },
  { index: 20, x: 30, y: -3.5, z: 0.6, yaw: 0 }, { index: 30, x: 30, y: 3.5, z: 0.6, yaw: 0 },
  { index: 40, x: 30, y: -7, z: 0.6, yaw: 180 }, { index: 50, x: 100, y: 0, z: 0.6, yaw: 0 },
];
const parameters = { distance: { value: 10 }, coordinate: { value: 25 } };
equal(mapLocation({ spawn_point_index: 10 }, points), points[1], 'spawn points resolve by explicit index rather than array position');
equal(mapLocation({ spawn_point_index: 1 }, points), null, 'missing spawn index does not resolve silently');
equal(mapLocation({ x: { $param: 'coordinate' }, y: 12 }, points, parameters), { x: 25, y: 12, z: undefined, yaw: undefined }, 'coordinates resolve parameter references');
equal(mapNumber({ $param: 'distance' }, parameters), 10, 'numeric parameter reads its declared current value');
equal(mapNumber({ $param: 'unknown' }, parameters), undefined, 'unknown parameter stays unresolved');
equal(mapNumber(Infinity), undefined, 'non-finite coordinates are not rendered');
const content = { map: { name: 'Town10HD_Opt' }, parameters, route: { start: { spawn_point_index: 0 }, waypoints: [{ spawn_point_index: 10 }], goal: { spawn_point_index: 50 } },
  actors: [{ id: 'car', type: 'vehicle', spawn: { spawn_point_index: 20 } }, { id: 'ped', type: 'pedestrian', spawn: { x: 25, y: 8 } }],
  events: [
    { id: 'cross', type: 'vehicle_crossing', actor_ref: 'car', trigger: { type: 'ego_distance_to_actor', actor_ref: 'car', distance_m: { $param: 'distance' } }, params: { destination: { spawn_point_index: 30 }, sync: { point: { x: 30, y: 0 }, offset_s: 0 } } },
    { id: 'walk', type: 'pedestrian_crossing', actor_ref: 'ped', trigger: { type: 'ego_distance_to_location', location: { x: 24, y: 0 }, distance_m: 8 }, params: { sync: { point: { x: 25, y: 0 } } } },
    { id: 'chain', type: 'lead_vehicle_brake', actor_ref: 'car', trigger: { type: 'after_event', event_ref: 'cross', delay_s: 1 }, params: {} },
  ] };
equal(mapTargets(content, 'route').map(item => item.path), [['route', 'start'], ['route', 'waypoints', 0], ['route', 'goal']], 'route picks preserve ordered intermediate waypoints');
equal(mapTargets(content, 'actors').map(item => [item.label, item.free]), [['car', false], ['ped', true]], 'pedestrians use free coordinates instead of vehicle-lane spawn points');
equal(mapTargets(content, 'events').map(item => item.path), [['events', 0, 'params', 'destination'], ['events', 0, 'params', 'sync', 'point'], ['events', 1, 'trigger', 'location'], ['events', 1, 'params', 'sync', 'point']], 'crossing destination, trigger and synchronisation pick paths match canonical JSON');
const scene = buildMapScene(content, points);
equal(scene.route.map(item => item.kind), ['start', 'waypoint', 'goal'], 'route visualization preserves progression');
equal(scene.zones.map(zone => zone.radius), [10, 8], 'actor and location trigger zones use resolved distances');
equal(scene.paths.length, 2, 'vehicle and pedestrian conflict paths are shown');
equal(scene.paths[0].sync, { x: 30, y: 0, z: undefined, yaw: undefined }, 'conflict point is preserved');
equal(scene.issues, [], 'valid metadata resolves every displayed location');
equal(buildMapScene({ route: { start: { spawn_point_index: 999 } } }, points).issues, ['Start'], 'invalid metadata position is explicitly reported');
const start = { ...points[0] };
equal(relativeMapPosition(points, start, 30, 'same'), { spawn_point_index: 10 }, 'same-lane placement excludes ego start and picks matching heading');
equal(relativeMapPosition(points, start, 30, 'left'), { spawn_point_index: 20 }, 'left placement follows CARLA right-positive coordinates');
equal(relativeMapPosition(points, start, 30, 'right'), { spawn_point_index: 30 }, 'right lane placement is consistent');
equal(relativeMapPosition(points, start, 30, 'oncoming'), { spawn_point_index: 40 }, 'oncoming lane uses opposite heading');
equal(relativeMapPosition(points, start, 30, 'kerb_right'), { x: 30, y: 6.8, z: 1.1, yaw: -90 }, 'pedestrian kerb placement uses nearby lane edge and ground height');
equal(relativeMapPosition([], start, 30, 'same'), null, 'no metadata cannot invent a spawn');
equal(relativeMapPosition([points[0], points[1]], start, 30, 'oncoming'), null, 'missing oncoming lane returns no placement');
const fitted = fitMapBox([{ x: 5, y: 5 }]);
equal([fitted.w > 0, fitted.h > 0, Number.isFinite(fitted.x)], [true, true, true], 'one-point map still has a valid visible viewport');
const zoomed = zoomMapBox({ x: -100, y: -100, w: 200, h: 200 }, 0.5, { x: 0, y: 0 });
equal(zoomed, { x: -50, y: -50, w: 100, h: 100 }, 'zoom keeps the chosen world point fixed');
const minimum = zoomMapBox({ x: 0, y: 0, w: 60, h: 60 }, 0.001, { x: 0, y: 0 });
equal(minimum.w, 15, 'zoom cannot shrink the map below the usable 15m window');
console.log(`Reference, coverage and map contracts: ${assertions} assertions passed; zero backend/network writes.`);
console.log('ASX_COVERAGE:' + JSON.stringify(calls.map(call => `${call.method} ${call.path}`)));
