import { describe, expect, it } from "vitest";
import type { TeamObject } from "../services/teamContracts";
import { buildMapScene, fitMapBox, mapLocation, mapNumber, mapTargets, relativeMapPosition, zoomMapBox } from "../services/teamMapGeometry";
import type { TeamSpawnPoint } from "../services/teamReferenceData";

const points: TeamSpawnPoint[] = [
  { index: 0, x: 0, y: 0, z: 1, yaw: 0 }, { index: 1, x: 20, y: 0, z: 1, yaw: 0 },
  { index: 2, x: 20, y: 3.5, z: 1, yaw: 0 }, { index: 3, x: 20, y: -3.5, z: 1, yaw: 180 },
];

describe("CARLA metadata preview geometry", () => {
  it("FE-UT-036 resolves numeric parameters including zero and rejects missing/non-finite values", () => {
    expect(mapNumber({ $param: "zero" }, { zero: { value: 0 } })).toBe(0);
    expect(mapNumber(3)).toBe(3);
    expect(mapNumber({ $param: "missing" }, {})).toBeUndefined();
    expect(mapNumber(NaN)).toBeUndefined();
    expect(mapNumber(Infinity)).toBeUndefined();
    expect(mapNumber("3")).toBeUndefined();
  });

  it("FE-UT-037 resolves spawn indices only in the selected exact map", () => {
    const otherMap = [{ ...points[0]!, x: 999 }];
    expect(mapLocation({ spawn_point_index: 0 }, points)?.x).toBe(0);
    expect(mapLocation({ spawn_point_index: 0 }, otherMap)?.x).toBe(999);
    expect(mapLocation({ spawn_point_index: 1 }, otherMap)).toBeNull();
    expect(mapLocation({ x: 0, y: 4, z: 2, yaw: 90 }, [])).toEqual({ x: 0, y: 4, z: 2, yaw: 90 });
  });

  it("FE-UT-038 distinguishes route, free-position actors and event target paths", () => {
    const content: TeamObject = { route: { waypoints: [{ spawn_point_index: 1 }] }, actors: [{ id: "walker", type: "pedestrian" }],
      events: [{ id: "cross", type: "vehicle_crossing", trigger: { type: "ego_distance_to_location" }, params: { sync: { point: { x: 1, y: 2 } } } }] };
    expect(mapTargets(content, "route").map(x => x.path)).toEqual([["route", "start"], ["route", "waypoints", 0], ["route", "goal"]]);
    expect(mapTargets(content, "actors")[0]).toEqual({ label: "walker", path: ["actors", 0, "spawn"], free: true });
    expect(mapTargets(content, "events").map(x => x.path)).toEqual([
      ["events", 0, "trigger", "location"], ["events", 0, "params", "destination"], ["events", 0, "params", "sync", "point"],
    ]);
  });

  it("FE-UT-039 unresolved positions produce warnings instead of invented preview actors", () => {
    const scene = buildMapScene({ route: { start: { spawn_point_index: 0 }, goal: { spawn_point_index: 999 } },
      actors: [{ id: "valid", type: "vehicle", spawn: { spawn_point_index: 1 } }, { id: "missing", type: "vehicle", spawn: { spawn_point_index: 999 } }], events: [] }, points);
    expect(scene.route).toHaveLength(1);
    expect(scene.actors.map(x => x.id)).toEqual(["valid"]);
    expect(scene.issues).toEqual(["Goal", "missing"]);
  });

  it("FE-UT-040 fitting and zoom stay finite for empty, coincident and very wide scenes", () => {
    expect(fitMapBox([])).toEqual({ x: -30, y: -30, w: 60, h: 60 });
    const box = fitMapBox([{ x: 3, y: 3 }, { x: 3, y: 3 }]);
    expect(box.w).toBeGreaterThanOrEqual(60);
    const tiny = zoomMapBox(box, .00001, { x: 3, y: 3 });
    const huge = zoomMapBox(box, 99999, { x: 3, y: 3 });
    expect(tiny.w).toBeGreaterThanOrEqual(15);
    expect(huge.w).toBeLessThanOrEqual(4000);
    expect(Object.values(fitMapBox([{ x: -100000, y: 0 }, { x: 100000, y: 0 }])).every(Number.isFinite)).toBe(true);
  });

  it("FE-UT-041 relative placement explicitly returns no candidate and never mutates map data", () => {
    const original = structuredClone(points);
    expect(relativeMapPosition([], points[0]!, 20, "same")).toBeNull();
    expect(relativeMapPosition(points, points[0]!, 20, "same")).toEqual({ spawn_point_index: 1 });
    expect(relativeMapPosition(points, points[0]!, 20, "right")).toEqual({ spawn_point_index: 2 });
    expect(relativeMapPosition(points, points[0]!, 20, "oncoming")).toEqual({ spawn_point_index: 3 });
    const kerb = relativeMapPosition(points, points[0]!, 20, "kerb_right");
    expect(typeof kerb?.x).toBe("number");
    expect(points).toEqual(original);
  });
});
