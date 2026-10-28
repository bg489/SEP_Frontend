import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "../localeContext";
import { carlaVehicles } from "../data/carlaVehicles";
import { teamObject, teamString, type TeamJson, type TeamMap, type TeamObject, type TeamValidation } from "../services/teamContracts";
import { conditionalSchema, resolveSchema, schemaBranch, schemaChangeType, schemaInitial, schemaRead, schemaUpdate, type SchemaPath, type TeamSchema } from "../services/teamSchemaEditor";
import "./TeamSchemaEditor.css";

const labels: Record<string, [string, string]> = {
  metadata: ["Version metadata", "Metadata phiên bản"], name: ["Name", "Tên"], category: ["Category", "Phân loại"], description: ["Description", "Mô tả"], tags: ["Metadata tags", "Tag trong metadata"],
  source: ["Source and provenance", "Nguồn gốc và truy xuất"], type: ["Type", "Loại"], format: ["Format", "Định dạng"], original_file: ["Original file", "Tệp gốc"], original_hash: ["Original hash", "Hash gốc"], parent_version_id: ["Parent version ID", "ID phiên bản cha"], import_warnings: ["Import warnings", "Cảnh báo nhập"],
  map: ["CARLA map", "Bản đồ CARLA"], route: ["Route and positions", "Tuyến đường và vị trí"], start: ["Start", "Điểm đầu"], goal: ["Goal", "Đích"], waypoints: ["Intermediate waypoints", "Điểm trung gian"], spawn_point_index: ["Spawn point index", "Chỉ số spawn"], x: ["X (m)", "X (m)"], y: ["Y (m)", "Y (m)"], z: ["Z (m)", "Z (m)"], yaw: ["Yaw (°)", "Góc yaw (°)"], speed_limit_kmh: ["Oracle speed limit (km/h)", "Giới hạn tốc độ Oracle (km/h)"], goal_tolerance_m: ["Goal tolerance (m)", "Dung sai đích (m)"],
  weather: ["Weather and environment", "Thời tiết và môi trường"], preset: ["Weather preset", "Mẫu thời tiết"], cloudiness: ["Cloudiness", "Độ mây"], precipitation: ["Rain", "Lượng mưa"], precipitation_deposits: ["Puddles", "Nước đọng"], wind_intensity: ["Wind", "Gió"], sun_azimuth_angle: ["Sun azimuth (°)", "Góc phương vị mặt trời (°)"], sun_altitude_angle: ["Sun altitude (°)", "Góc cao mặt trời (°)"], fog_density: ["Fog density", "Mật độ sương"], fog_distance: ["Fog start distance (m)", "Khoảng cách bắt đầu sương (m)"], wetness: ["Road wetness", "Độ ướt đường"],
  ego_vehicle: ["Ego vehicle", "Xe chính"], blueprint: ["CARLA blueprint", "Mẫu CARLA"], role_name: ["Actor role name", "Nhãn vai trò actor"], color: ["RGB color", "Màu RGB"], initial_speed_kmh: ["Initial speed (km/h)", "Tốc độ ban đầu (km/h)"], target_speed_kmh: ["Target speed (km/h)", "Tốc độ mục tiêu (km/h)"],
  traffic: ["Background traffic", "Giao thông nền"], npc_vehicles: ["Background vehicles", "Xe nền"], pedestrians: ["Background pedestrians", "Người đi bộ nền"], count: ["Count", "Số lượng"], blueprint_filter: ["Blueprint filter", "Bộ lọc mẫu"], four_wheels_only: ["Only four-wheel vehicles", "Chỉ xe bốn bánh"], speed_difference_percent: ["Speed difference % (+ slower)", "Chênh tốc độ % (+ chậm hơn)"], distance_to_leading_m: ["Following distance (m)", "Khoảng cách bám xe (m)"], crossing_probability: ["Crossing probability (0–1)", "Xác suất qua đường (0–1)"], running_probability: ["Running probability (0–1)", "Xác suất chạy (0–1)"],
  actors: ["Scripted actors and obstacles", "Actor kịch bản và vật cản"], id: ["ID", "ID"], spawn: ["Spawn position", "Vị trí tạo"], behavior: ["Behavior", "Hành vi"], events: ["Events and triggers", "Event và điều kiện kích hoạt"], trigger: ["Trigger", "Điều kiện kích hoạt"], actor_ref: ["Actor reference", "Actor tham chiếu"], event_ref: ["Previous event", "Event trước"], params: ["Action parameters", "Tham số hành động"], distance_m: ["Trigger distance (m)", "Khoảng cách kích hoạt (m)"], time_s: ["Simulation time (s)", "Thời điểm mô phỏng (s)"], delay_s: ["Delay after event (s)", "Độ trễ sau event (s)"], ttc_s: ["Time to collision (s)", "Thời gian tới va chạm (s)"], location: ["Trigger position", "Vị trí kích hoạt"],
  speed_ms: ["Walking speed (m/s)", "Tốc độ đi bộ (m/s)"], direction: ["Crossing direction", "Hướng qua đường"], side: ["Cut-in side", "Hướng chen làn"], cut_in_gap_m: ["Cut-in gap (m)", "Khoảng cách chen làn (m)"], lane_change_duration_s: ["Lane-change duration (s)", "Thời gian đổi làn (s)"], deceleration_ms2: ["Deceleration (m/s²)", "Giảm tốc (m/s²)"], time_gap_s: ["Following time gap (s)", "Khoảng cách thời gian bám xe (s)"], target: ["Target", "Mục tiêu"], state: ["Light state", "Trạng thái đèn"], duration_s: ["Duration (s)", "Thời lượng (s)"], destination: ["Destination", "Điểm đến"], speed_kmh: ["Crossing speed (km/h)", "Tốc độ xe cắt ngang (km/h)"], ignore_traffic_lights: ["Ignore traffic lights", "Bỏ qua đèn giao thông"], sync: ["Synchronize arrival", "Đồng bộ thời điểm đến"], point: ["Conflict / synchronization point", "Điểm xung đột / đồng bộ"], offset_s: ["Arrival offset (s)", "Độ lệch thời điểm đến (s)"],
  parameters: ["Reusable numeric parameters", "Tham số số tái sử dụng"], value: ["Current value", "Giá trị hiện tại"], min: ["Minimum", "Nhỏ nhất"], max: ["Maximum", "Lớn nhất"], step: ["Range step", "Bước giá trị"], unit: ["Unit", "Đơn vị"], execution: ["Execution settings", "Cấu hình thực thi"], seed: ["Random seed", "Seed ngẫu nhiên"], timeout_s: ["Simulation timeout (s)", "Thời hạn mô phỏng (s)"], fixed_delta_seconds: ["Fixed time step (s)", "Bước mô phỏng (s)"], synchronous_mode: ["Synchronous mode", "Chế độ đồng bộ"], warmup_s: ["Warm-up (s)", "Ổn định ban đầu (s)"], extensions: ["Extensions JSON", "JSON mở rộng"],
};
const choices: Record<string, [string, string]> = {
  idle: ["Idle", "Đứng yên"], scripted: ["Scripted", "Theo kịch bản"], autopilot: ["Autopilot", "Tự lái"], vehicle: ["Vehicle", "Xe"], pedestrian: ["Pedestrian", "Người đi bộ"], bicycle: ["Bicycle", "Xe đạp"], static_obstacle: ["Static obstacle", "Vật cản tĩnh"],
  pedestrian_crossing: ["Pedestrian crossing", "Người qua đường"], vehicle_cut_in: ["Vehicle cut-in", "Xe chen làn"], lead_vehicle_brake: ["Lead vehicle brakes", "Xe trước phanh"], traffic_light_override: ["Traffic-light override", "Ghi đè đèn giao thông"], vehicle_crossing: ["Crossing vehicle", "Xe cắt ngang"], simulation_time: ["Simulation time", "Thời điểm mô phỏng"], ego_distance_to_actor: ["Ego distance to actor", "Khoảng cách Ego tới actor"], ego_distance_to_location: ["Ego distance to position", "Khoảng cách Ego tới vị trí"], after_event: ["After another event", "Sau event khác"], time_to_collision: ["Time to collision", "Thời gian tới va chạm"],
  left_to_right: ["Left to right", "Trái sang phải"], right_to_left: ["Right to left", "Phải sang trái"], left: ["Left", "Trái"], right: ["Right", "Phải"], red: ["Red", "Đỏ"], yellow: ["Yellow", "Vàng"], green: ["Green", "Xanh"], next_on_route: ["Next light on route", "Đèn tiếp theo trên tuyến"],
};
type Context = { content: TeamObject; defs: Record<string, TeamSchema>; maps: TeamMap[]; disabled: boolean; report: TeamValidation | null; vi: boolean; change: (path: SchemaPath, value: TeamJson | undefined) => void };
const pointer = (path: SchemaPath) => "/" + path.map(part => String(part).replaceAll("~", "~0").replaceAll("/", "~1")).join("/");

export function TeamSchemaEditor({ schema, content, maps, disabled, report, onChange, focusTarget }: { schema: TeamObject; content: TeamObject; maps: TeamMap[]; disabled: boolean; report: TeamValidation | null; onChange: (content: TeamObject) => void; focusTarget?: { path: string; nonce: number } }) {
  const { locale } = useLocale();
  const vi = locale === "vi";
  const [section, setSection] = useState("route");
  const root = schema as unknown as TeamSchema;
  useEffect(() => {
    if (!focusTarget?.path.startsWith("/")) return;
    const section = focusTarget.path.split("/")[1];
    if (root.properties?.[section]) setSection(section);
    const timer = window.setTimeout(() => {
      let path = focusTarget.path;
      while (path) {
        const target = document.getElementById("team-schema-" + encodeURIComponent(path));
        if (target) { target.scrollIntoView({ behavior: "smooth", block: "center" }); target.querySelector<HTMLInputElement | HTMLSelectElement>("input:not([readonly]),select")?.focus({ preventScroll: true }); break; }
        path = path.slice(0, path.lastIndexOf("/"));
      }
    }, 20);
    return () => window.clearTimeout(timer);
  }, [focusTarget, root.properties]);
  const ctx: Context = { content, defs: root.$defs ?? {}, maps, disabled, report, vi, change: (path, value) => onChange(path.at(-1) === "type" && value !== undefined ? schemaChangeType(content, path, value, root.$defs ?? {}) : schemaUpdate(content, path, value)) };
  const groups = ["metadata", "map", "route", "ego_vehicle", "weather", "traffic", "actors", "events", "parameters", "execution", "source", "extensions"].filter(key => root.properties?.[key]);
  return <div className="team-guided-editor">
    <p className="team-help">{vi ? "Các ô cấu hình đọc trực tiếp từ schema backend: hỗ trợ chuỗi event, TTC, xe cắt ngang, đồng bộ thời điểm và tham chiếu tham số. Thay đổi tại đây và JSON dùng chung một bản nháp; hãy lưu rồi kiểm tra trước khi xuất bản." : "These controls read the backend schema directly, including event chains, TTC, crossing vehicles, synchronized arrival and parameter references. The form and JSON edit the same draft; save and validate before publishing."}</p>
    <nav className="team-schema-nav" aria-label={vi ? "Nhóm cấu hình" : "Definition sections"}>{groups.map(key => <button type="button" key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}>{labels[key]?.[vi ? 1 : 0] ?? key}</button>)}</nav>
    <fieldset disabled={disabled} className="team-schema-section"><legend>{labels[section]?.[vi ? 1 : 0] ?? section}</legend><SchemaField key={section} ctx={ctx} schema={root.properties?.[section] ?? {}} path={[section]} required={root.required?.includes(section)} /></fieldset>
    <datalist id="team-guided-blueprints">{carlaVehicles.map(vehicle => <option key={vehicle.blueprint} value={vehicle.blueprint}>{vehicle.label}</option>)}<option value="walker.pedestrian.0001" /><option value="static.prop.trafficcone01" /><option value="static.prop.streetbarrier" /></datalist>
  </div>;
}

function SchemaField({ ctx, schema: raw, path, required, plain = false }: { ctx: Context; schema: TeamSchema; path: SchemaPath; required?: boolean; plain?: boolean }) {
  const [newKey, setNewKey] = useState("");
  const [localError, setLocalError] = useState("");
  const [rawValue, setRawValue] = useState<string | null>(null);
  const t = (en: string, vi: string) => ctx.vi ? vi : en;
  const value = schemaRead(ctx.content, path);
  const schema = conditionalSchema(raw, value, ctx.defs);
  const key = String(path.at(-1));
  const title = labels[key]?.[ctx.vi ? 1 : 0] ?? key.replaceAll("_", " ");
  const id = "team-schema-" + encodeURIComponent(pointer(path));
  const errors = [...(ctx.report?.errors ?? []), ...(ctx.report?.warnings ?? [])].filter(issue => issue.path === pointer(path));
  const wrap = (node: ReactNode) => <div className={`team-schema-field${errors.length ? " has-issue" : ""}`} id={id} data-schema-path={pointer(path)}>{node}{errors.map((issue, index) => <p className={ctx.report?.errors.includes(issue) ? "team-error-text" : "team-warning-text"} key={index}>{issue.message}</p>)}{localError && <p className="team-error-text">{localError}</p>}</div>;
  const label = <span>{title}{required ? " *" : ""}</span>;
  if (schema.oneOf) {
    const branches = schema.oneOf.map(item => resolveSchema(item, ctx.defs));
    const paramIndex = branches.findIndex(item => item.properties?.$param);
    const current = schemaBranch(schema, value, ctx.defs);
    const ref = teamObject(value).$param;
    if (paramIndex >= 0) {
      const numericIndex = branches.findIndex(item => item.type === "number" || item.type === "integer");
      return wrap(<><div className="team-schema-mode"><b>{title}{required ? " *" : ""}</b><select aria-label={`${title} ${t("value mode", "kiểu giá trị")}`} value={typeof ref === "string" ? "parameter" : "number"} onChange={event => ctx.change(path, event.target.value === "parameter" ? { $param: Object.keys(teamObject(ctx.content.parameters))[0] ?? "" } : schemaInitial(branches[numericIndex], ctx.defs))}><option value="number">{t("Fixed value", "Giá trị cố định")}</option><option value="parameter">{t("Parameter reference", "Tham chiếu tham số")}</option></select></div>{typeof ref === "string" ? <label>{t("Parameter", "Tham số")}<select value={ref} onChange={event => ctx.change(path, { $param: event.target.value })}><option value="">{t("Choose parameter", "Chọn tham số")}</option>{Object.entries(teamObject(ctx.content.parameters)).map(([name, definition]) => <option key={name} value={name}>{name} · {String(teamObject(definition).value ?? "")} {String(teamObject(definition).unit ?? "")}</option>)}</select></label> : <SchemaField ctx={ctx} schema={branches[numericIndex]} path={path} required={required} plain />}</>);
    }
    return wrap(<><label>{t("Position / condition format", "Dạng vị trí / điều kiện")}<select value={current} onChange={event => ctx.change(path, schemaInitial(branches[Number(event.target.value)], ctx.defs))}>{branches.map((branch, index) => {
      const type = branch.properties?.type?.const;
      const caption = typeof type === "string" ? choices[type]?.[ctx.vi ? 1 : 0] ?? type : branch.properties?.spawn_point_index ? t("Spawn point index", "Chỉ số spawn") : branch.properties?.x ? t("CARLA x / y / z / yaw", "Tọa độ CARLA x / y / z / yaw") : `${t("Option", "Lựa chọn")} ${index + 1}`;
      return <option key={index} value={index}>{caption}</option>;
    })}</select></label><SchemaField ctx={ctx} schema={branches[current]} path={path} required={required} plain /></>);
  }
  if (schema.const !== undefined) return wrap(<><label>{label}<input readOnly value={value === undefined ? "" : String(value)} placeholder={String(schema.const)} /></label>{value !== schema.const && <><small className="team-warning-text">{t("Required schema value", "Giá trị schema yêu cầu")}: {String(schema.const)}</small><button type="button" className="btn btn-light" onClick={() => ctx.change(path, schema.const)}>{t("Apply required value", "Áp dụng giá trị bắt buộc")}</button></>}</>);
  if (schema.type === "object") {
    if (value === undefined && !required) return wrap(<button type="button" className="btn btn-light" onClick={() => ctx.change(path, schemaInitial(schema, ctx.defs))}>{t("Add", "Thêm")} {title}</button>);
    const object = teamObject(value);
    const props = Object.entries(schema.properties ?? {});
    if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
      const itemSchema = schema.additionalProperties;
      return wrap(<div className="team-schema-object"><p className="team-help">{t("Define numeric parameters here, then select Parameter reference in the fields they control.", "Khai báo tham số số tại đây, sau đó chọn Tham chiếu tham số ở ô cần điều khiển.")}</p>{Object.keys(object).map(name => <details className="team-schema-item" key={name} open><summary>{name}</summary><SchemaField ctx={ctx} schema={itemSchema} path={[...path, name]} required /><button type="button" className="btn btn-light" onClick={() => ctx.change([...path, name], undefined)}>{t("Remove parameter", "Xóa tham số")}</button></details>)}<div className="team-schema-add-key"><label>{t("Parameter name", "Tên tham số")}<input value={newKey} maxLength={32} pattern="[a-z][a-z0-9_]{0,31}" onChange={event => { setNewKey(event.target.value); setLocalError(""); }} /></label><button type="button" className="btn btn-light" disabled={Object.keys(object).length >= (schema.maxProperties ?? Infinity)} onClick={() => { if (!/^[a-z][a-z0-9_]{0,31}$/.test(newKey) || object[newKey] !== undefined) { setLocalError(t("Use a unique lowercase identifier, up to 32 characters.", "Dùng tên duy nhất, bắt đầu chữ thường, tối đa 32 ký tự.")); return; } ctx.change([...path, newKey], schemaInitial(itemSchema, ctx.defs)); setNewKey(""); }}>{t("Add parameter", "Thêm tham số")}</button></div></div>);
    }
    if (!props.length) return wrap(<label>{label}<textarea className="team-json-editor" rows={6} value={rawValue ?? JSON.stringify(object, null, 2)} onChange={event => { const text = event.target.value; setRawValue(text); try { const parsed: unknown = JSON.parse(text); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); ctx.change(path, parsed as TeamObject); setLocalError(""); } catch { setLocalError(t("Enter a JSON object.", "Nhập một JSON object.")); } }} /></label>);
    return wrap(<div className={`team-schema-object${plain ? " plain" : ""}`}>{!plain && <div className="team-schema-group-title"><b>{title}</b>{!required && <button type="button" className="btn btn-light" onClick={() => ctx.change(path, undefined)}>{t("Remove optional group", "Bỏ nhóm tùy chọn")}</button>}</div>}<div className="team-form-grid">{props.map(([name, child]) => <SchemaField key={name} ctx={ctx} schema={child} path={[...path, name]} required={schema.required?.includes(name)} />)}</div></div>);
  }
  if (schema.type === "array") {
    const items = Array.isArray(value) ? value : [];
    return wrap(<div className="team-schema-array"><b>{title} · {items.length}{schema.maxItems ? `/${schema.maxItems}` : ""}</b>{items.map((item, index) => <details className="team-schema-item" key={index} open><summary>{teamString(teamObject(item).id, `${title} ${index + 1}`)}{teamObject(item).type ? ` · ${String(teamObject(item).type)}` : ""}</summary><SchemaField ctx={ctx} schema={schema.items ?? {}} path={[...path, index]} required /><button type="button" className="btn btn-light" onClick={() => ctx.change(path, items.filter((_, at) => at !== index))}>{t("Remove", "Xóa")} {index + 1}</button></details>)}<button type="button" className="btn btn-light" disabled={items.length >= (schema.maxItems ?? Infinity)} onClick={() => { let next = schemaInitial(schema.items ?? {}, ctx.defs); if (key === "actors" || key === "events") { const obj = teamObject(next); let index = items.length + 1; while (items.some(item => teamObject(item).id === `${key === "actors" ? "actor" : "event"}_${index}`)) index++; obj.id = `${key === "actors" ? "actor" : "event"}_${index}`; if (key === "actors") obj.blueprint = "vehicle.tesla.model3"; next = obj; } ctx.change(path, [...items, next]); }}>{t("Add item", "Thêm mục")}</button></div>);
  }
  const optionalRemove = !required && value !== undefined ? <button type="button" className="team-schema-unset" onClick={() => ctx.change(path, undefined)}>{t("Use default / omit", "Mặc định / bỏ trống")}</button> : null;
  if (schema.type === "boolean") return wrap(<><label className="team-checkbox"><input type="checkbox" checked={value === true} onChange={event => ctx.change(path, event.target.checked)} />{title}</label>{optionalRemove}</>);
  const enumValues = schema.enum;
  if (enumValues) return wrap(<><label>{label}<select value={value === undefined ? "" : String(value)} onChange={event => ctx.change(path, event.target.value || undefined)}><option value="">{t("Choose / use default", "Chọn / dùng mặc định")}</option>{enumValues.map(item => <option key={String(item)} value={String(item)}>{choices[String(item)]?.[ctx.vi ? 1 : 0] ?? String(item)}</option>)}</select></label>{optionalRemove}</>);
  if (path[0] === "map" && key === "name") return wrap(<label>{label}<select value={teamString(value)} onChange={event => { if (event.target.value !== value && !window.confirm(t("Spawn indices and coordinates belong to the selected map. Keep the numbers and review every position after changing maps?", "Spawn index và tọa độ thuộc từng bản đồ. Giữ nguyên số và kiểm tra lại mọi vị trí sau khi đổi bản đồ?"))) return; ctx.change(path, event.target.value); }}><option value="">{t("Choose map", "Chọn bản đồ")}</option>{!ctx.maps.some(map => map.mapName === value) && value && <option value={String(value)}>{String(value)}</option>}{ctx.maps.map(map => <option key={map.mapName}>{map.mapName}</option>)}</select></label>);
  if (key === "actor_ref" || key === "event_ref") {
    let references = (Array.isArray(ctx.content[key === "event_ref" ? "events" : "actors"]) ? ctx.content[key === "event_ref" ? "events" : "actors"] : []) as TeamJson[];
    const currentEvent = teamObject(schemaRead(ctx.content, path.slice(0, 2)));
    if (key === "event_ref") references = references.filter(item => teamObject(item).id !== currentEvent.id);
    if (path[0] === "events" && path.length === 3 && key === "actor_ref") references = references.filter(item => teamObject(item).type === (currentEvent.type === "pedestrian_crossing" ? "pedestrian" : "vehicle"));
    return wrap(<label>{label}<select value={teamString(value)} onChange={event => ctx.change(path, event.target.value)}><option value="">{t("Choose reference", "Chọn tham chiếu")}</option>{references.map(teamObject).map(item => <option key={String(item.id)} value={String(item.id)}>{String(item.id)} · {String(item.type)}</option>)}</select></label>);
  }
  const numeric = schema.type === "number" || schema.type === "integer";
  const range = numeric ? [schema.minimum !== undefined ? `≥ ${schema.minimum}` : schema.exclusiveMinimum !== undefined ? `> ${schema.exclusiveMinimum}` : "", schema.maximum !== undefined ? `≤ ${schema.maximum}` : "", schema.type === "integer" ? t("integer", "số nguyên") : ""].filter(Boolean).join(" · ") : schema.pattern ?? "";
  return wrap(<><label>{plain ? null : label}{numeric ? <SchemaNumberInput label={title} value={typeof value === "number" ? value : undefined} minimum={schema.minimum} maximum={schema.maximum} integer={schema.type === "integer"} placeholder={schema.default !== undefined ? String(schema.default) : ""} onChange={next => ctx.change(path, next)} /> : <input aria-label={title} type="text" value={typeof value === "string" ? value : ""} minLength={schema.minLength} maxLength={schema.maxLength} pattern={schema.pattern} list={key === "blueprint" ? "team-guided-blueprints" : undefined} placeholder={schema.default !== undefined ? String(schema.default) : ""} onChange={event => ctx.change(path, event.target.value === "" ? undefined : event.target.value)} />}</label>{range && <small className="team-schema-range">{range}</small>}{optionalRemove}</>);
}

/** Keep partial minus signs, decimal points and exponents while editing numbers.
 * Only finite values enter the canonical JSON; an incomplete edit is restored on blur. */
function SchemaNumberInput({ label, value, minimum, maximum, integer, placeholder, onChange }: {
  label: string; value: number | undefined; minimum?: number; maximum?: number;
  integer: boolean; placeholder: string; onChange: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState<{ source: number | undefined; text: string } | null>(null);
  const shown = draft && Object.is(draft.source, value) ? draft.text : value === undefined ? "" : String(value);
  return <input type="text" inputMode={integer ? "numeric" : "decimal"} role="spinbutton" aria-label={label}
    aria-valuenow={value} aria-valuemin={minimum} aria-valuemax={maximum} placeholder={placeholder}
    value={shown} onBlur={() => setDraft(null)} onChange={event => {
      const text = event.target.value;
      if (text === "") { setDraft({ source: undefined, text }); onChange(undefined); return; }
      if (!/^-?\d*(?:\.\d*)?(?:[eE][+-]?\d*)?$/.test(text)) return;
      const next = Number(text);
      if (Number.isFinite(next) && /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) {
        setDraft({ source: next, text }); onChange(next);
      } else setDraft({ source: value, text });
    }} />;
}
