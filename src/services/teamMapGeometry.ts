import type { TeamJson, TeamObject } from "./teamContracts";
import type { TeamSpawnPoint } from "./teamReferenceData";

export type MapPoint = { x: number; y: number; z?: number; yaw?: number; index?: number };
export type MapBox = { x: number; y: number; w: number; h: number };
export type MapPickScope = "route" | "actors" | "events";
export type MapPickTarget = { label: string; path: (string | number)[]; free?: boolean };
export type RelativeLane = "same" | "left" | "right" | "oncoming" | "kerb_right" | "kerb_left";
const obj = (value: TeamJson | undefined): TeamObject => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const list = (value: TeamJson | undefined): TeamJson[] => Array.isArray(value) ? value : [];
export const mapDistance = (a: MapPoint, b: MapPoint) => Math.hypot(a.x - b.x, a.y - b.y);
export const mapRound = (n: number) => Math.round(n * 10) / 10;
const rad = (n: number) => n * Math.PI / 180;
export function mapNumber(value: TeamJson | undefined, parameters: TeamObject = {}): number | undefined {
  const name = obj(value).$param;
  const result = typeof name === "string" ? obj(parameters[name]).value : value;
  return typeof result === "number" && Number.isFinite(result) ? result : undefined;
}
export function mapLocation(value: TeamJson | undefined, points: TeamSpawnPoint[], parameters: TeamObject = {}): MapPoint | null {
  const v = obj(value), index = mapNumber(v.spawn_point_index, parameters);
  if (index !== undefined) return points.find(point => point.index === index) ?? null;
  const x = mapNumber(v.x, parameters), y = mapNumber(v.y, parameters);
  return x === undefined || y === undefined ? null : { x, y, z: mapNumber(v.z, parameters), yaw: mapNumber(v.yaw, parameters) };
}
export function mapTargets(content: TeamObject, scope: MapPickScope): MapPickTarget[] {
  if (scope === "route") return [{ label: "Start", path: ["route", "start"] },
    ...list(obj(content.route).waypoints).map((_, i) => ({ label: `Waypoint ${i + 1}`, path: ["route", "waypoints", i] })),
    { label: "Goal", path: ["route", "goal"] }];
  if (scope === "actors") return list(content.actors).map((value, i) => {
    const actor = obj(value);
    return { label: String(actor.id ?? `Actor ${i + 1}`), path: ["actors", i, "spawn"], free: actor.type === "pedestrian" || actor.type === "static_obstacle" };
  });
  return list(content.events).flatMap((value, i) => {
    const event = obj(value), name = String(event.id ?? `Event ${i + 1}`), params = obj(event.params);
    return [
      ...(obj(event.trigger).type === "ego_distance_to_location" ? [{ label: `${name} · trigger`, path: ["events", i, "trigger", "location"], free: true }] : []),
      ...(event.type === "vehicle_crossing" ? [{ label: `${name} · destination`, path: ["events", i, "params", "destination"] }] : []),
      ...(["vehicle_crossing", "pedestrian_crossing"].includes(String(event.type)) && params.sync ? [{ label: `${name} · conflict`, path: ["events", i, "params", "sync", "point"], free: true }] : []),
    ];
  });
}
export function buildMapScene(content: TeamObject, points: TeamSpawnPoint[]) {
  const parameters = obj(content.parameters), route = obj(content.route), issues: string[] = [];
  const locate = (value: TeamJson | undefined, label: string) => {
    const result = mapLocation(value, points, parameters);
    if (!result && Object.keys(obj(value)).length) issues.push(label);
    return result;
  };
  const routePoints: { kind: "start" | "waypoint" | "goal"; label: string; at: MapPoint }[] = [];
  const add = (value: TeamJson | undefined, kind: "start" | "waypoint" | "goal", label: string) => { const at = locate(value, label); if (at) routePoints.push({ kind, label, at }); };
  add(route.start, "start", "Start"); list(route.waypoints).forEach((value, i) => add(value, "waypoint", `Waypoint ${i + 1}`)); add(route.goal, "goal", "Goal");
  const actors = list(content.actors).flatMap((value, i) => {
    const actor = obj(value), id = String(actor.id ?? `Actor ${i + 1}`), at = locate(actor.spawn, id);
    return at ? [{ id, type: String(actor.type ?? "actor"), at, raw: actor }] : [];
  });
  const zones: { at: MapPoint; radius: number; label: string }[] = [];
  const paths: { from: MapPoint; to: MapPoint; sync: MapPoint | null; label: string }[] = [];
  list(content.events).forEach((value, i) => {
    const event = obj(value), trigger = obj(event.trigger), params = obj(event.params), label = String(event.id ?? `Event ${i + 1}`);
    const actor = actors.find(item => item.id === event.actor_ref);
    const triggerAt = trigger.type === "ego_distance_to_actor" ? actors.find(item => item.id === trigger.actor_ref)?.at
      : trigger.type === "ego_distance_to_location" ? locate(trigger.location, `${label} trigger`) : undefined;
    const radius = mapNumber(trigger.distance_m, parameters);
    if (triggerAt && radius !== undefined) zones.push({ at: triggerAt, radius, label });
    const sync = params.sync ? locate(obj(params.sync).point, `${label} conflict`) : null;
    const to = event.type === "vehicle_crossing" ? locate(params.destination, `${label} destination`) : event.type === "pedestrian_crossing" ? sync : null;
    if (actor && to) paths.push({ from: actor.at, to, sync, label });
  });
  return { route: routePoints, actors, zones, paths, issues };
}
export function fitMapBox(points: MapPoint[], minimum = 60): MapBox {
  if (!points.length) return { x: -30, y: -30, w: 60, h: 60 };
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const w = Math.max(minimum, right - left), h = Math.max(minimum, bottom - top), pad = Math.max(w, h) * 0.08;
  return { x: (left + right - w) / 2 - pad, y: (top + bottom - h) / 2 - pad, w: w + pad * 2, h: h + pad * 2 };
}
export function zoomMapBox(box: MapBox, factor: number, at: MapPoint): MapBox {
  const f = Math.min(Math.max(factor, 15 / Math.min(box.w, box.h)), 4000 / Math.max(box.w, box.h));
  return { x: at.x - (at.x - box.x) * f, y: at.y - (at.y - box.y) * f, w: box.w * f, h: box.h * f };
}
/** Lane positions are approximate: metadata contains spawn positions, not road topology. */
export function relativeMapPosition(points: TeamSpawnPoint[], start: MapPoint & { yaw: number }, ahead: number, lane: RelativeLane): TeamObject | null {
  if (!points.length) return null;
  const h = rad(start.yaw), width = 3.5;
  const candidates = points.filter(p => p.index !== start.index).map(p => {
    const dx = p.x - start.x, dy = p.y - start.y;
    return { p, ahead: dx * Math.cos(h) + dy * Math.sin(h), right: -dx * Math.sin(h) + dy * Math.cos(h), turn: Math.abs(((p.yaw - start.yaw) % 360 + 540) % 360 - 180) };
  });
  if (lane === "kerb_left" || lane === "kerb_right") {
    const sign = lane === "kerb_right" ? 1 : -1;
    const offsets = candidates.filter(c => Math.abs(c.ahead - ahead) < 20 && (c.turn < 30 || c.turn > 150) && c.right * sign > 0).map(c => c.right * sign).sort((a, b) => a - b);
    let edge = 0;
    for (const offset of offsets) if (offset - edge <= width * 1.5) edge = Math.max(edge, offset);
    const right = sign * (edge + width / 2 + 1.5);
    const x = start.x + ahead * Math.cos(h) - right * Math.sin(h), y = start.y + ahead * Math.sin(h) + right * Math.cos(h);
    const nearest = points.reduce((a, b) => mapDistance(a, { x, y }) <= mapDistance(b, { x, y }) ? a : b);
    return { x: mapRound(x), y: mapRound(y), z: mapRound(nearest.z + 0.5), yaw: mapRound(((start.yaw + (right > 0 ? -90 : 90) + 540) % 360) - 180) };
  }
  const offset = lane === "left" ? -width : lane === "right" ? width : 0;
  let pool = candidates.filter(c => lane === "oncoming" ? c.turn > 150 && c.right < 0 : c.turn < 30 && Math.abs(c.right - offset) < width / 2);
  if (lane === "oncoming" && pool.length) { const edge = Math.max(...pool.map(c => c.right)); pool = pool.filter(c => Math.abs(c.right - edge) < width / 2); }
  if (!pool.length) return null;
  const best = pool.reduce((a, b) => Math.abs(a.ahead - ahead) <= Math.abs(b.ahead - ahead) ? a : b);
  return { spawn_point_index: best.p.index };
}
