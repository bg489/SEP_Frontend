import { useId, useMemo, useState } from "react";
import { carlaVehicles } from "../data/carlaVehicles";
import { Icon } from "./Icon";

export function VehicleSelect({ name, label, defaultValue }: {
  name: string;
  label: string;
  defaultValue?: string;
}) {
  const selectId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All vehicles");
  const [selectedId, setSelectedId] = useState(defaultValue ?? "vehicle.tesla.model3");
  const selected = carlaVehicles.find((vehicle) => vehicle.blueprint === selectedId);
  const visible = useMemo(() => carlaVehicles.filter((vehicle) =>
    (category === "All vehicles" || vehicle.category === category) &&
    `${vehicle.label} ${vehicle.blueprint}`.toLowerCase().includes(query.trim().toLowerCase()),
  ), [category, query]);
  const categories = ["All vehicles", "Car", "Truck", "Van", "Bus", "Motorcycle", "Bicycle"];

  return (
    <div className="vehicle-select">
      <label htmlFor={selectId}>{label}</label>
      <div className="vehicle-select-filters">
        <label className="vehicle-search">
          <Icon name="search" size={13} />
          <input aria-label="Search vehicle models" placeholder="Search vehicle models…" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <select aria-label="Vehicle category" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      <select id={selectId} name={name} value={selectedId} onChange={(event) => setSelectedId(event.target.value)} required>
        {!visible.some((vehicle) => vehicle.blueprint === selectedId) && <option value={selectedId}>{selected?.label ?? selectedId} · Selected</option>}
        {visible.map((vehicle) => <option key={vehicle.blueprint} value={vehicle.blueprint}>{vehicle.label} · {vehicle.category}</option>)}
      </select>
      <small className="vehicle-blueprint">{selectedId}</small>
      {!visible.length && <small>No vehicle models match these filters.</small>}
    </div>
  );
}
