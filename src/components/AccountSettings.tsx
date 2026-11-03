import { useState, type FormEvent } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "../app/store";
import { changePasswordRequested, profileUpdateRequested } from "../features/auth/authSlice";
import { isTeamDevAuth } from "../services/authConfig";
import { useLocale } from "../localeContext";
import { Icon } from "./Icon";

/** Account writes go through authSaga; names are displayed from the returned account. */
export function AccountSettings() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, busy, error, message } = useSelector((state: RootState) => state.auth);
  const { locale } = useLocale();
  const text = (en: string, vi: string) => locale === "vi" ? vi : en;
  const [name, setName] = useState(user?.name ?? "");
  const [passwordError, setPasswordError] = useState("");
  if (!user) return null;
  const password = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword !== data.get("confirmPassword")) {
      setPasswordError(text("Passwords do not match.", "Hai mật khẩu không khớp.")); return;
    }
    setPasswordError("");
    dispatch(changePasswordRequested({ currentPassword: String(data.get("currentPassword") ?? ""), newPassword }));
    form.reset();
  };
  return <div className="role-page-stack account-settings">
    <section className="profile-hero"><span className="profile-large-avatar"><Icon name="users" size={28} /></span>
      <div><small>{text("MY ACCOUNT", "TÀI KHOẢN CỦA TÔI")}</small><h2>{user.name}</h2><p>{user.email} · {user.role}</p></div>
    </section>
    {(error || passwordError) && <div className="auth-message auth-error" role="alert">{passwordError || error}</div>}
    {message && <div className="auth-message" role="status">{message}</div>}
    <div className="profile-layout">
      <form className="card profile-form" aria-busy={busy} onSubmit={event => { event.preventDefault(); if (!busy) dispatch(profileUpdateRequested(name.trim())); }}>
        <h3>{text("Profile details", "Thông tin cá nhân")}</h3>
        <label>{text("Full name", "Họ và tên")}<input required maxLength={120} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
        <label>{text("Email address", "Địa chỉ email")}<input type="email" value={user.email} readOnly /></label>
        <label>{text("Workspace role", "Vai trò")}<input value={user.role} readOnly /></label>
        <button className="btn btn-primary" disabled={busy || !name.trim()}>{busy ? <i className="button-spinner" /> : <Icon name="check" size={15} />}{text("Save profile", "Lưu hồ sơ")}</button>
      </form>
      <form className="card profile-form" aria-busy={busy} onSubmit={password}>
        <h3>{text("Change password", "Đổi mật khẩu")}</h3>
        {isTeamDevAuth && <p>{text("Password changes require signing in with your Supabase account.", "Đổi mật khẩu yêu cầu đăng nhập bằng tài khoản Supabase.")}</p>}
        <label>{text("Current password", "Mật khẩu hiện tại")}<input name="currentPassword" type="password" autoComplete="current-password" required disabled={busy || isTeamDevAuth} /></label>
        <label>{text("New password", "Mật khẩu mới")}<input name="newPassword" type="password" autoComplete="new-password" minLength={8} required disabled={busy || isTeamDevAuth} /></label>
        <label>{text("Confirm new password", "Xác nhận mật khẩu mới")}<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required disabled={busy || isTeamDevAuth} /></label>
        <button className="btn btn-primary" disabled={busy || isTeamDevAuth}>{busy && <i className="button-spinner" />}{text("Change password", "Đổi mật khẩu")}</button>
      </form>
    </div>
  </div>;
}
