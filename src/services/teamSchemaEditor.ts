import type { TeamJson, TeamObject } from "./teamContracts";
import { teamObject } from "./teamContracts";

export type SchemaPath = (string | number)[];
export interface TeamSchema {
  $ref?: string; type?: string; properties?: Record<string, TeamSchema>; required?: string[];
  oneOf?: TeamSchema[]; enum?: TeamJson[]; const?: TeamJson; default?: TeamJson;
  items?: TeamSchema; minimum?: number; maximum?: number; exclusiveMinimum?: number;
  minLength?: number; maxLength?: number; pattern?: string; maxItems?: number; maxProperties?: number;
  description?: string; additionalProperties?: boolean | TeamSchema; $defs?: Record<string, TeamSchema>;
  allOf?: { if?: TeamSchema; then?: TeamSchema & { not?: { required?: string[] } } }[];
}
export function schemaRead(content: TeamObject, path: SchemaPath): TeamJson | undefined {
  return path.reduce<TeamJson | undefined>((node, part) => node && typeof node === "object" ? (node as Record<string, TeamJson>)[String(part)] : undefined, content);
}
/** Immutable update that preserves unknown fields and exact canonical numeric/parameter types. */
export function schemaUpdate(content: TeamObject, path: SchemaPath, value: TeamJson | undefined): TeamObject {
  if (!path.length) return value && typeof value === "object" && !Array.isArray(value) ? value : content;
  const clone = structuredClone(content);
  let node: TeamObject | TeamJson[] = clone;
  path.slice(0, -1).forEach((part, index) => {
    const record = node as Record<string, TeamJson>;
    if (!record[String(part)] || typeof record[String(part)] !== "object") record[String(part)] = typeof path[index + 1] === "number" ? [] : {};
    node = record[String(part)] as TeamObject | TeamJson[];
  });
  const last = path.at(-1)!;
  if (value === undefined) {
    if (Array.isArray(node)) node.splice(Number(last), 1);
    else delete node[String(last)];
  } else (node as Record<string, TeamJson>)[String(last)] = value;
  return clone;
}
export function resolveSchema(schema: TeamSchema, defs: Record<string, TeamSchema>): TeamSchema {
  return schema.$ref ? { ...resolveSchema(defs[schema.$ref.split("/").at(-1)!] ?? {}, defs), ...schema, $ref: undefined } : schema;
}
export function conditionalSchema(schema: TeamSchema, value: TeamJson | undefined, defs: Record<string, TeamSchema>): TeamSchema {
  let next = resolveSchema(schema, defs);
  for (const rule of next.allOf ?? []) {
    const matches = Object.entries(rule.if?.properties ?? {}).every(([key, condition]) => {
      const item = teamObject(value)[key];
      return condition.const !== undefined ? item === condition.const : condition.enum ? condition.enum.includes(item) : true;
    });
    if (!matches || !rule.then) continue;
    next = { ...next, properties: { ...next.properties, ...rule.then.properties }, required: [...new Set([...(next.required ?? []), ...(rule.then.required ?? [])])] };
    if (rule.then.not?.required) {
      const properties = { ...next.properties };
      rule.then.not.required.forEach(key => { delete properties[key]; });
      next = { ...next, properties };
    }
  }
  return next;
}
export function schemaInitial(schema: TeamSchema, defs: Record<string, TeamSchema>): TeamJson {
  const s = resolveSchema(schema, defs);
  if (s.default !== undefined) return structuredClone(s.default);
  if (s.const !== undefined) return structuredClone(s.const);
  if (s.enum?.length) return structuredClone(s.enum[0]);
  if (s.oneOf?.length) return schemaInitial(s.oneOf[0], defs);
  if (s.type === "object") {
    const seed: TeamObject = {};
    for (const name of s.required ?? []) seed[name] = schemaInitial(s.properties?.[name] ?? {}, defs);
    const effective = conditionalSchema(s, seed, defs);
    for (const name of effective.required ?? []) if (!(name in seed)) seed[name] = schemaInitial(effective.properties?.[name] ?? {}, defs);
    return seed;
  }
  if (s.type === "array") return [];
  if (s.type === "number" || s.type === "integer") return s.minimum ?? (s.exclusiveMinimum !== undefined ? s.exclusiveMinimum + 1 : 0);
  if (s.type === "boolean") return false;
  return "";
}
export function schemaBranch(schema: TeamSchema, value: TeamJson | undefined, defs: Record<string, TeamSchema>): number {
  const branches = schema.oneOf ?? [];
  const object = teamObject(value);
  const match = branches.findIndex(raw => {
    const s = resolveSchema(raw, defs);
    if (s.type === "number" || s.type === "integer") return typeof value === "number";
    return (s.required ?? []).every(key => key in object)
      && Object.entries(s.properties ?? {}).every(([key, child]) => child.const === undefined || object[key] === child.const);
  });
  return Math.max(0, match);
}
/** Changing an event type replaces its old action params, so unsupported params cannot leak across actions. */
export function schemaChangeType(content: TeamObject, path: SchemaPath, value: TeamJson, defs: Record<string, TeamSchema>): TeamObject {
  let next = schemaUpdate(content, path, value);
  if (path[0] === "events" && path.length === 3 && path[2] === "type") {
    const eventPath = path.slice(0, 2);
    const event = teamObject(schemaRead(next, eventPath));
    const schema = conditionalSchema(defs.event ?? {}, event, defs);
    const params = schema.properties?.params;
    if (params) next = schemaUpdate(next, [...eventPath, "params"], schemaInitial(params, defs));
    const actors = Array.isArray(content.actors) ? content.actors.map(teamObject) : [];
    const suitable = actors.filter(actor => value === "pedestrian_crossing" ? actor.type === "pedestrian" : actor.type === "vehicle");
    next = schemaUpdate(next, [...eventPath, "actor_ref"], value === "traffic_light_override" ? undefined : String(suitable[0]?.id ?? ""));
  }
  if (path[0] === "actors" && path.length === 3 && path[2] === "type") {
    const suggestions: Record<string, string> = { vehicle: "vehicle.tesla.model3", pedestrian: "walker.pedestrian.0001", bicycle: "vehicle.bh.crossbike", static_obstacle: "static.prop.trafficcone01" };
    next = schemaUpdate(next, [...path.slice(0, 2), "blueprint"], suggestions[String(value)] ?? "");
    if (value === "static_obstacle") next = schemaUpdate(next, [...path.slice(0, 2), "behavior"], "idle");
  }
  return next;
}
export function parameterRangeValues(definition: TeamObject, limit = 1000): number[] {
  const min = Number(definition.min), max = Number(definition.max);
  const step = typeof definition.step === "number" ? definition.step : definition.type === "integer" ? 1 : max - min;
  if (![min, max, step].every(Number.isFinite) || min > max || step < 0 || min !== max && step === 0) return [];
  if (min === max) return [min];
  const count = Math.floor((max - min) / step + 1e-9) + 1;
  if (count > limit) throw new Error(`Parameter range contains more than ${limit} values. Use a larger step or explicit values.`);
  const values = Array.from({ length: count }, (_, i) => Number((min + i * step).toPrecision(12)));
  if (values.at(-1)! < max - 1e-9) values.push(max);
  return values;
}
