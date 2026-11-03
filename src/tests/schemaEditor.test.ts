import { describe, expect, it } from "vitest";
import type { TeamObject } from "../services/teamContracts";
import {
  conditionalSchema, parameterRangeValues, schemaBranch, schemaChangeType,
  schemaInitial, schemaRead, schemaUpdate, type TeamSchema,
} from "../services/teamSchemaEditor";

describe("canonical scenario editor", () => {
  it("FE-UT-026 nested edits preserve unknown fields, parameter references and source", () => {
    const original: TeamObject = { route: { start: { x: 1, y: 2 }, goal: { spawn_point_index: 7 } },
      parameters: { speed: { value: 20 } }, ego_vehicle: { initial_speed_kmh: { $param: "speed" } }, extension: { keep: true } };
    const frozen = structuredClone(original);
    const changed = schemaUpdate(original, ["route", "start", "x"], 0);
    expect(original).toEqual(frozen);
    expect(schemaRead(changed, ["route", "start", "x"])).toBe(0);
    expect(changed.extension).toEqual({ keep: true });
    expect(schemaRead(changed, ["ego_vehicle", "initial_speed_kmh"])).toEqual({ $param: "speed" });
  });

  it("FE-UT-027 removes object properties and splices arrays without holes", () => {
    const source: TeamObject = { actors: [{ id: "a" }, { id: "b" }], note: "remove" };
    const changed = schemaUpdate(schemaUpdate(source, ["note"], undefined), ["actors", 0], undefined);
    expect(changed).toEqual({ actors: [{ id: "b" }] });
    expect(source.actors).toHaveLength(2);
    expect(source.note).toBe("remove");
  });

  it("FE-UT-028 applies only matching conditional event rules", () => {
    const schema: TeamSchema = { type: "object", properties: { type: { type: "string" }, actor_ref: { type: "string" } },
      allOf: [
        { if: { properties: { type: { const: "traffic_light_override" } } }, then: { required: ["params"], properties: { params: { type: "object" } }, not: { required: ["actor_ref"] } } },
        { if: { properties: { type: { const: "pedestrian_crossing" } } }, then: { required: ["actor_ref"] } },
      ] };
    const light = conditionalSchema(schema, { type: "traffic_light_override" }, {});
    expect(light.required).toContain("params");
    expect(light.properties).not.toHaveProperty("actor_ref");
    expect(conditionalSchema(schema, { type: "pedestrian_crossing" }, {}).required).toEqual(["actor_ref"]);
    expect(conditionalSchema(schema, { type: "other" }, {}).required).toBeUndefined();
  });

  it("FE-UT-029 initializes required/default/reference/numeric values without shared mutations", () => {
    const defs: Record<string, TeamSchema> = { position: { type: "object", required: ["x"], properties: { x: { type: "number", minimum: -5 } } } };
    const schema: TeamSchema = { type: "object", required: ["position", "speed", "actor"], properties: {
      position: { $ref: "#/$defs/position" }, speed: { type: "number", exclusiveMinimum: 0 }, actor: { default: { type: "vehicle" } },
    } };
    const value = schemaInitial(schema, defs) as TeamObject;
    expect(value).toEqual({ position: { x: -5 }, speed: 1, actor: { type: "vehicle" } });
    (value.actor as TeamObject).type = "changed";
    expect(schema.properties!.actor!.default).toEqual({ type: "vehicle" });
    expect(schemaInitial({ type: "string", enum: ["Low", "High"] }, {})).toBe("Low");
  });

  it("FE-UT-030 selects number and exact coordinate/spawn branches", () => {
    const schema: TeamSchema = { oneOf: [{ type: "number" }, { type: "object", required: ["spawn_point_index"] },
      { type: "object", required: ["x", "y"] }] };
    expect(schemaBranch(schema, 0, {})).toBe(0);
    expect(schemaBranch(schema, { spawn_point_index: 3 }, {})).toBe(1);
    expect(schemaBranch(schema, { x: 0, y: 7 }, {})).toBe(2);
    expect(schemaBranch(schema, undefined, {})).toBe(0);
  });

  it("FE-UT-031 event type changes clear incompatible parameters and choose a suitable actor", () => {
    const defs: Record<string, TeamSchema> = { event: { type: "object", allOf: [
      { if: { properties: { type: { const: "pedestrian_crossing" } } }, then: { properties: { params: { default: { speed_mps: 1.4 } } } } },
      { if: { properties: { type: { const: "traffic_light_override" } } }, then: { properties: { params: { default: { state: "Red" } } } } },
    ] } };
    const source: TeamObject = { actors: [{ id: "car", type: "vehicle" }, { id: "walker", type: "pedestrian" }],
      events: [{ type: "lead_vehicle_brake", actor_ref: "car", params: { brake: 1 } }] };
    const pedestrian = schemaChangeType(source, ["events", 0, "type"], "pedestrian_crossing", defs);
    expect(schemaRead(pedestrian, ["events", 0, "params"])).toEqual({ speed_mps: 1.4 });
    expect(schemaRead(pedestrian, ["events", 0, "actor_ref"])).toBe("walker");
    const light = schemaChangeType(pedestrian, ["events", 0, "type"], "traffic_light_override", defs);
    expect(schemaRead(light, ["events", 0, "actor_ref"])).toBeUndefined();
    expect(schemaRead(light, ["events", 0, "params"])).toEqual({ state: "Red" });
    expect(schemaRead(source, ["events", 0, "params"])).toEqual({ brake: 1 });
  });

  it("FE-UT-032 actor type changes update blueprint and static behavior while preserving id", () => {
    const source: TeamObject = { actors: [{ id: "obstacle", type: "vehicle", blueprint: "old", behavior: "scripted", spawn: { x: 1, y: 2 } }] };
    const result = schemaChangeType(source, ["actors", 0, "type"], "static_obstacle", {});
    expect(schemaRead(result, ["actors", 0, "blueprint"])).toBe("static.prop.trafficcone01");
    expect(schemaRead(result, ["actors", 0, "behavior"])).toBe("idle");
    expect(schemaRead(result, ["actors", 0, "id"])).toBe("obstacle");
    expect(schemaRead(result, ["actors", 0, "spawn"])).toEqual({ x: 1, y: 2 });
    expect(schemaRead(schemaChangeType(source, ["actors", 0, "type"], "pedestrian", {}), ["actors", 0, "blueprint"])).toBe("walker.pedestrian.0001");
  });

  it("FE-UT-033 parameter ranges include endpoints exactly once without floating drift", () => {
    expect(parameterRangeValues({ type: "number", min: 0, max: .3, step: .1 })).toEqual([0, .1, .2, .3]);
    expect(parameterRangeValues({ min: 0, max: 1, step: .3 })).toEqual([0, .3, .6, .9, 1]);
    expect(parameterRangeValues({ type: "integer", min: 2, max: 2 })).toEqual([2]);
  });

  it("FE-UT-034 invalid parameter ranges do not generate misleading values", () => {
    for (const definition of [{ min: 3, max: 1 }, { min: 0, max: 3, step: 0 }, { min: 0, max: 3, step: -1 },
      { min: "bad", max: 3 }, { min: 0, max: Infinity }]) expect(parameterRangeValues(definition as TeamObject)).toEqual([]);
  });

  it("FE-UT-035 excessive parameter grids fail before allocation", () => {
    expect(() => parameterRangeValues({ type: "integer", min: 0, max: 10000 }, 100)).toThrow("more than 100 values");
  });
});
