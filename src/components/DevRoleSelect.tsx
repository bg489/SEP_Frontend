import { useId } from "react";
import { useLocale } from "../localeContext";
import { isTeamDevAuth } from "../services/authConfig";
import { devRoles, devRoleToUserRole, isDevRole, type DevRole } from "../services/devRole";
import "./DevRoleSelect.css";

export function DevRoleSelect({ value, onChange, disabled = false, compact = false }: {
  value: DevRole; onChange: (role: DevRole) => void; disabled?: boolean; compact?: boolean;
}) {
  const id = useId();
  const { locale } = useLocale();
  if (!isTeamDevAuth) return null;
  const vi = locale === "vi";
  const labels: Record<DevRole, string> = { SCENARIO_ENGINEER: "Kỹ sư kịch bản", TEST_ENGINEER: "Kỹ sư kiểm thử",
    TEST_REVIEWER: "Người đánh giá kiểm thử", ADMIN: "Quản trị viên" };
  return <div className={`dev-role-select${compact ? " dev-role-compact" : ""}`}>
    <label htmlFor={id}>{vi ? "Vai trò Dev" : "Dev role"}</label>
    <select id={id} value={value} disabled={disabled} onChange={event => {
      if (isDevRole(event.target.value)) onChange(event.target.value);
    }}>
      {devRoles.map(role => <option key={role} value={role}>{vi ? labels[role] : devRoleToUserRole(role)}</option>)}
    </select>
    {!compact && <small>{vi ? "Đổi quyền tạm thời để kiểm thử. Không thay đổi role của tài khoản trong database." : "Temporarily switch permissions for testing. This does not change the account's database role."}</small>}
  </div>;
}
