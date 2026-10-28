import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale } from "../localeContext";
import { teamObject, teamString, type TeamApiClient, type TeamJson, type TeamObject } from "../services/teamContracts";
import { referenceApi, type TeamMapDetail, type TeamSpawnPoint } from "../services/teamReferenceData";
import { buildMapScene, fitMapBox, mapDistance, mapNumber, mapRound, mapTargets, relativeMapPosition, zoomMapBox,
  type MapBox, type MapPickScope, type MapPoint, type RelativeLane } from "../services/teamMapGeometry";
import { Icon } from "./Icon";
import "./TeamMapView.css";

export interface TeamMapViewProps {
  client: TeamApiClient; content: TeamObject; readOnly?: boolean;
  pick?: { scope: MapPickScope; onPick: (path: (string | number)[], value: TeamJson) => void };
}

const list = (value: TeamJson | undefined) => Array.isArray(value) ? value.map(teamObject) : [];
const toWorld = (svg: SVGSVGElement, x: number, y: number): MapPoint | null => {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const result = new DOMPoint(x, y).matrixTransform(matrix.inverse());
  return { x: result.x, y: result.y };
};
const arrow = (p: MapPoint, size: number) => {
  const angle = (p.yaw ?? 0) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  return [[3, 0], [-1.5, 1.7], [-1.5, -1.7]].map(([a, b]) => `${p.x + size * (a * cos - b * sin)},${p.y + size * (a * sin + b * cos)}`).join(" ");
};

/** Map metadata viewer: road geometry and live CARLA actor state are intentionally not inferred. */
export function TeamMapView({ client, content, pick, readOnly = false }: TeamMapViewProps) {
  const { locale } = useLocale(), vi = locale === "vi";
  const t = (en: string, translated: string) => vi ? translated : en;
  const api = useMemo(() => referenceApi(client), [client]);
  const mapName = teamString(teamObject(content.map).name);
  const [map, setMap] = useState<TeamMapDetail | null>(null), [error, setError] = useState("");
  const [loading, setLoading] = useState(false), [revision, setRevision] = useState(0);
  const [view, setView] = useState<"scenario" | "map">("scenario"), [zoom, setZoom] = useState<MapBox | null>(null);
  const [hover, setHover] = useState<TeamSpawnPoint | null>(null), [cursor, setCursor] = useState<MapPoint | null>(null);
  const [targetIndex, setTargetIndex] = useState(0), [actorIndex, setActorIndex] = useState(0);
  const [ahead, setAhead] = useState(30), [relativeLane, setRelativeLane] = useState<RelativeLane>("same"), [placeMessage, setPlaceMessage] = useState("");
  const svg = useRef<SVGSVGElement>(null), shown = useRef<MapBox | null>(null);
  const drag = useRef<{ x: number; y: number; box: MapBox; moved: boolean } | null>(null), dragged = useRef(false);
  const patternId = useId().replace(/:/g, "");

  useEffect(() => {
    let active = true;
    setMap(null); setError(""); setZoom(null); setHover(null); setCursor(null); setPlaceMessage("");
    if (!mapName) { setLoading(false); return; }
    setLoading(true);
    void api.map(mapName).then(value => { if (active) setMap(value); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, mapName, revision]);

  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const at = toWorld(node, event.clientX, event.clientY);
      if (at && shown.current) setZoom(zoomMapBox(shown.current, Math.exp(event.deltaY * 0.003), at));
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [map]);

  const effectivePick = readOnly ? undefined : pick;
  const targets = effectivePick ? mapTargets(content, effectivePick.scope) : [];
  const target = targets[Math.min(targetIndex, targets.length - 1)];
  const points = map?.spawnPoints ?? [], scene = buildMapScene(content, points);
  const scenePoints = [...scene.route.map(p => p.at), ...scene.actors.map(p => p.at), ...scene.paths.flatMap(p => p.sync ? [p.to, p.sync] : [p.to]),
    ...scene.zones.flatMap(z => [{ x: z.at.x - z.radius, y: z.at.y - z.radius }, { x: z.at.x + z.radius, y: z.at.y + z.radius }])];
  const box = zoom ?? fitMapBox(view === "scenario" && scenePoints.length ? scenePoints : points);
  useEffect(() => { shown.current = box; }, [box]);
  const k = Math.max(box.w, box.h) / 620;
  const start = scene.route.find(p => p.kind === "start"), goal = scene.route.find(p => p.kind === "goal");
  const routeDistance = scene.route.slice(1).reduce((sum, p, i) => sum + mapDistance(scene.route[i].at, p.at), 0);
  const actors = list(content.actors), selectedActor = actors[Math.min(actorIndex, actors.length - 1)];
  const onFoot = selectedActor && ["pedestrian", "static_obstacle"].includes(String(selectedActor.type));
  const laneOptions: [RelativeLane, string, string][] = onFoot ? [["kerb_right", "Right kerb", "Lề phải"], ["kerb_left", "Left kerb", "Lề trái"]]
    : [["same", "Same lane", "Cùng làn"], ["left", "Lane to the left", "Làn bên trái"], ["right", "Lane to the right", "Làn bên phải"], ["oncoming", "Oncoming lane", "Làn ngược chiều"]];
  const chosenLane = laneOptions.some(([lane]) => lane === relativeLane) ? relativeLane : laneOptions[0][0];
  const selectSpawn = (point: TeamSpawnPoint) => {
    setHover(point);
    if (!target || target.free || !effectivePick || dragged.current) return;
    effectivePick.onPick(target.path, { spawn_point_index: point.index }); setZoom(box);
    if (target.path.join(".") === "route.start") { const next = targets.findIndex(item => item.path.join(".") === "route.goal"); if (next >= 0) setTargetIndex(next); }
  };
  const events = list(content.events), parameters = teamObject(content.parameters);
  const positionLabel = (label: string) => label === "Start" ? t("Start", "Xuất phát") : label === "Goal" ? t("Goal", "Đích")
    : label.startsWith("Waypoint ") ? label.replace("Waypoint ", t("Waypoint ", "Điểm trung gian "))
    : label.replace(/ · trigger$/, t(" · trigger", " · kích hoạt")).replace(/ · destination$/, t(" · destination", " · đích")).replace(/ · conflict$/, t(" · conflict", " · xung đột"));
  const exactTime = (index: number, seen = new Set<number>()): number | undefined => {
    if (seen.has(index)) return undefined;
    seen.add(index);
    const trigger = teamObject(events[index]?.trigger);
    if (trigger.type === "simulation_time") return mapNumber(trigger.time_s, parameters);
    if (trigger.type !== "after_event") return undefined;
    const prior = events.findIndex(event => event.id === trigger.event_ref), delay = mapNumber(trigger.delay_s, parameters);
    if (prior < 0 || delay === undefined) return undefined;
    const at = exactTime(prior, seen); return at === undefined ? undefined : at + delay;
  };

  return <section className="team-map-view" aria-label={t("Scenario map metadata", "Metadata bản đồ scenario")}>
    <div className="tm-heading"><div><span className="tm-eyebrow">CARLA · {t("MAP METADATA", "METADATA BẢN ĐỒ")}</span><h4>{mapName || t("Choose a map", "Chọn bản đồ")}</h4></div><div className="tm-actions">
      <button type="button" className={view === "scenario" ? "active" : ""} onClick={() => { setView("scenario"); setZoom(null); }}>{t("Scenario", "Kịch bản")}</button>
      <button type="button" className={view === "map" ? "active" : ""} onClick={() => { setView("map"); setZoom(null); }}>{t("Whole map", "Toàn bản đồ")}</button>
      <button type="button" disabled={loading || !mapName} onClick={() => setRevision(n => n + 1)} aria-label={t("Reload map metadata", "Tải lại metadata bản đồ")}><Icon name="refresh" size={14} /></button>
    </div></div>
    <p className="tm-help">{t("Spawn positions and headings from the backend. Connecting lines illustrate the scenario; CARLA plans the driven road route. This is not a live simulation.", "Vị trí spawn và hướng từ backend. Đường nối minh họa kịch bản; CARLA sẽ tìm tuyến trên đường. Đây không phải mô phỏng trực tiếp.")}</p>
    {loading && <p className="tm-state" role="status"><i className="button-spinner" /> {t("Loading map positions…", "Đang tải vị trí bản đồ…")}</p>}
    {error && <div className="tm-state tm-error" role="alert">{error}<button type="button" onClick={() => setRevision(n => n + 1)}>{t("Retry", "Thử lại")}</button></div>}
    {!loading && !error && map && <>
      {target && <div className="tm-picking"><label>{t("Position to set", "Vị trí cần đặt")}<select value={Math.min(targetIndex, targets.length - 1)} onChange={event => setTargetIndex(Number(event.target.value))}>{targets.map((item, i) => <option key={item.path.join(".")} value={i}>{positionLabel(item.label)}</option>)}</select></label><span>{target.free ? t("Click anywhere on the map; height comes from the nearest spawn point.", "Bấm vị trí bất kỳ; độ cao lấy theo spawn point gần nhất.") : t("Click a spawn point, or select its index below.", "Bấm spawn point hoặc chọn chỉ số bên dưới.")}</span>{!target.free && <select aria-label={t("Spawn index to place", "Chỉ số spawn cần đặt")} value="" onChange={event => { const point = points.find(p => p.index === Number(event.target.value)); if (point) selectSpawn(point); }}><option value="">{t("Choose spawn…", "Chọn spawn…")}</option>{points.map(p => <option key={p.index} value={p.index}>#{p.index} · {mapRound(p.x)}, {mapRound(p.y)} · {mapRound(p.yaw)}°</option>)}</select>}</div>}
      {effectivePick?.scope === "actors" && actors.length > 0 && <form className="tm-relative" onSubmit={event => {
        event.preventDefault(); if (!start || start.at.yaw === undefined) return;
        const value = relativeMapPosition(points, { ...start.at, yaw: start.at.yaw }, ahead, chosenLane);
        if (!value) { setPlaceMessage(t("No matching spawn point was found. Choose a position manually.", "Không tìm được spawn phù hợp. Hãy chọn vị trí thủ công.")); return; }
        effectivePick.onPick(["actors", Math.min(actorIndex, actors.length - 1), "spawn"], value); setZoom(null);
        setPlaceMessage(`${String(selectedActor?.id)} → ${JSON.stringify(value)}`);
      }}><b>{t("Place relative to Ego start", "Đặt tương đối với điểm đầu Ego")}</b><label>{t("Actor", "Actor")}<select value={Math.min(actorIndex, actors.length - 1)} onChange={event => setActorIndex(Number(event.target.value))}>{actors.map((actor, i) => <option key={i} value={i}>{String(actor.id ?? i + 1)}</option>)}</select></label><label>{t("Metres ahead (negative: behind)", "Mét phía trước (âm: phía sau)")}<input type="number" min={-200} max={500} step={1} value={ahead} onChange={event => setAhead(Number(event.target.value))} required /></label><label>{t("Placement", "Vị trí tương đối")}<select value={chosenLane} onChange={event => setRelativeLane(event.target.value as RelativeLane)}>{laneOptions.map(([value,en,translated]) => <option key={value} value={value}>{t(en,translated)}</option>)}</select></label><button type="submit" disabled={!start || start.at.yaw === undefined}>{t("Apply position", "Áp dụng vị trí")}</button><small>{t("Approximation from spawn points and the start heading; road lanes and sidewalks are not part of this metadata. Inspect before publishing.", "Ước lượng từ spawn point và hướng xuất phát; metadata chưa có hình học làn/vỉa hè. Kiểm tra trước khi xuất bản.")}</small>{placeMessage && <small role="status">{placeMessage}</small>}</form>}
      <div className="tm-canvas"><svg ref={svg} viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} role="img" aria-label={`${map.mapName}: ${points.length} ${t("spawn points", "điểm spawn")}`} className={target ? "tm-pickable" : ""}
        onPointerDown={event => { dragged.current = false; if (event.button === 0) drag.current = { x: event.clientX, y: event.clientY, box, moved: false }; }}
        onPointerMove={event => {
          if (target?.free) setCursor(toWorld(event.currentTarget, event.clientX, event.clientY));
          const prior = drag.current, scale = svg.current?.getScreenCTM()?.a;
          if (!prior || !scale) return;
          const dx = event.clientX - prior.x, dy = event.clientY - prior.y;
          if (!prior.moved && Math.hypot(dx, dy) < 4) return;
          if (!prior.moved) { prior.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
          setZoom({ ...prior.box, x: prior.box.x - dx / scale, y: prior.box.y - dy / scale });
        }} onPointerUp={() => { dragged.current = drag.current?.moved ?? false; drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onPointerLeave={() => setCursor(null)}
        onClick={event => {
          if (!target?.free || !effectivePick || dragged.current || !points.length) return;
          const at = toWorld(event.currentTarget, event.clientX, event.clientY); if (!at) return;
          const near = points.reduce((a, b) => mapDistance(a, at) <= mapDistance(b, at) ? a : b);
          effectivePick.onPick(target.path, { x: mapRound(at.x), y: mapRound(at.y), z: mapRound(near.z) }); setZoom(box);
        }}>
        <defs><pattern id={patternId} width={k * 25} height={k * 25} patternUnits="userSpaceOnUse"><path d={`M ${k * 25} 0 L 0 0 0 ${k * 25}`} fill="none" stroke="#e9edf0" strokeWidth={k * 0.7} /></pattern></defs>
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={`url(#${patternId})`} />
        <g className="tm-spawn">{points.map(point => <g key={point.index} onMouseEnter={() => setHover(point)} onMouseLeave={() => setHover(null)} onClick={event => { if (!target?.free) { event.stopPropagation(); selectSpawn(point); } }}><title>#{point.index} · x {point.x}, y {point.y}, z {point.z} · yaw {point.yaw}°</title><polygon points={arrow(point, k * 1.7)} /><circle className="tm-hit" cx={point.x} cy={point.y} r={k * 9} /></g>)}</g>
        {scene.route.length > 1 && <polyline className="tm-route-line" points={scene.route.map(p => `${p.at.x},${p.at.y}`).join(" ")} strokeWidth={k * 1.8} strokeDasharray={`${k * 5} ${k * 4}`} />}
        {scene.zones.map((zone, i) => <circle key={i} className="tm-zone" cx={zone.at.x} cy={zone.at.y} r={zone.radius} strokeWidth={k * 1.3} strokeDasharray={`${k * 5} ${k * 3}`}><title>{zone.label} · {zone.radius} m</title></circle>)}
        {scene.paths.map((path, i) => <g key={i} className="tm-crossing"><title>{path.label}</title><line x1={path.from.x} y1={path.from.y} x2={path.to.x} y2={path.to.y} strokeWidth={k * 2} strokeDasharray={`${k * 5} ${k * 4}`} />{path.sync && <rect x={path.sync.x - k * 4} y={path.sync.y - k * 4} width={k * 8} height={k * 8} transform={`rotate(45 ${path.sync.x} ${path.sync.y})`} strokeWidth={k * 1.5} />}</g>)}
        {scene.actors.map(actor => <g key={actor.id} className="tm-actor"><title>{actor.id} · {actor.type}</title><rect x={actor.at.x - k * 6} y={actor.at.y - k * 6} width={k * 12} height={k * 12} rx={k * 2} strokeWidth={k * 1.5} /><text x={actor.at.x + k * 9} y={actor.at.y + k * 3} fontSize={k * 10}>{actor.id}</text>{actor.at.yaw !== undefined && <polygon points={arrow(actor.at, k * 1.5)} />}</g>)}
        {scene.route.map((point, i) => <g key={i} className={`tm-route-mark ${point.kind}`}><title>{point.label} · {point.at.index !== undefined ? `#${point.at.index}` : `${mapRound(point.at.x)}, ${mapRound(point.at.y)}`}</title><circle cx={point.at.x} cy={point.at.y} r={k * (point.kind === "waypoint" ? 6 : 8)} strokeWidth={k * 2} /><text x={point.at.x} y={point.at.y + k * 3.5} textAnchor="middle" fontSize={k * 9}>{point.kind === "start" ? "S" : point.kind === "goal" ? "G" : i}</text></g>)}
      </svg><div className="tm-zoom"><button type="button" onClick={() => setZoom(zoomMapBox(box, 1 / 1.5, { x: box.x + box.w / 2, y: box.y + box.h / 2 }))} aria-label={t("Zoom in", "Phóng to")}>+</button><button type="button" onClick={() => setZoom(zoomMapBox(box, 1.5, { x: box.x + box.w / 2, y: box.y + box.h / 2 }))} aria-label={t("Zoom out", "Thu nhỏ")}>−</button><button type="button" disabled={!zoom} onClick={() => setZoom(null)} aria-label={t("Fit view", "Vừa khung")}>↔</button></div></div>
      <p className="tm-position" aria-live="polite">{hover ? `#${hover.index} · x ${mapRound(hover.x)} · y ${mapRound(hover.y)} · z ${mapRound(hover.z)} · yaw ${mapRound(hover.yaw)}°` : target?.free && cursor ? `x ${mapRound(cursor.x)} · y ${mapRound(cursor.y)}` : t("Hover a spawn arrow to inspect its coordinates. Drag to pan; Ctrl + wheel to zoom.", "Rê vào mũi tên để xem tọa độ. Kéo để di chuyển; Ctrl + cuộn để phóng to.")}</p>
      <div className="tm-legend"><span>● S · {t("Start", "Xuất phát")}</span><span>● G · {t("Goal", "Đích")}</span><span>■ {t("Actor", "Actor")}</span><span>◌ {t("Trigger zone", "Vùng kích hoạt")}</span><span>◇ {t("Conflict point", "Điểm xung đột")}</span><span>{points.length} / {map.spawnPointCount} {t("spawn entries", "vị trí spawn")} · CARLA {map.carlaVersion}</span></div>
      {scene.issues.length > 0 && <p className="tm-warning">{t("Positions not resolved by this metadata", "Vị trí metadata chưa phân giải được")}: {scene.issues.join(", ")}</p>}
      {start && goal && <p className="tm-help">{t("Straight-line route length", "Độ dài đường nối thẳng")}: <b>{mapRound(routeDistance)} m</b> · {t("Start-to-goal distance", "Khoảng cách đầu–đích")}: {mapRound(mapDistance(start.at, goal.at))} m · {t("Goal tolerance", "Dung sai đích")}: {mapNumber(teamObject(content.route).goal_tolerance_m, parameters) ?? 5} m.</p>}
      {events.length > 0 && <details className="tm-story"><summary>{t("Event sequence and configuration", "Trình tự sự kiện và cấu hình")} ({events.length})</summary><p className="tm-help">{t("Times below are configured simulation times after warm-up. Distance/TTC triggers depend on the actual run; this preview does not predict their firing time.", "Thời điểm dưới đây tính theo cấu hình sau warm-up. Trigger khoảng cách/TTC phụ thuộc lần chạy thật; phần xem trước không dự đoán lúc kích hoạt.")}</p><ol>{events.map((event, i) => { const at = exactTime(i), trigger = teamObject(event.trigger); return <li key={`${event.id}:${i}`}><b>{String(event.id ?? i + 1)} · {String(event.type)}</b><span>{at !== undefined ? `${at} s` : String(trigger.type)}{event.actor_ref ? ` → ${event.actor_ref}` : ""}</span>{event.description && <p>{String(event.description)}</p>}<code>{JSON.stringify(trigger)}</code><code>{JSON.stringify(event.params)}</code></li>; })}</ol></details>}
    </>}
    {!loading && !error && map && points.length === 0 && <p className="tm-state">{t("The backend returned no spawn coordinates for this map.", "Backend chưa trả tọa độ spawn cho bản đồ này.")}</p>}
  </section>;
}
