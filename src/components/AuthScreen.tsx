import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { LanguageSwitcher } from "../i18n";
import { useLocale } from "../localeContext";
import type { LoginInput, RegisterInput, RegistrationRole, ResetPasswordInput } from "../services/authApi";
import { isTeamDevAuth } from "../services/authConfig";
import { DevRoleSelect } from "./DevRoleSelect";
import { getDevRole, setDevRole } from "../services/devRole";

type AuthMode = "login" | "register" | "forgot" | "reset";

function readRecoveryToken(): string {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get("type") === "recovery" ? hash.get("access_token") ?? "" : "";
  return token;
}

const registrationRoles: RegistrationRole[] = [
  "Scenario Engineer",
  "Test Engineer",
  "Test Reviewer",
];

interface AuthScreenProps {
  busy: boolean;
  error: string | null;
  notice: string | null;
  onLogin: (input: LoginInput) => void;
  onRegister: (input: RegisterInput) => void;
  onRequestPasswordReset: (email: string) => void;
  onResetPassword?: (input: ResetPasswordInput) => void;
}

export function AuthScreen({
  busy,
  error,
  notice,
  onLogin,
  onRegister,
  onRequestPasswordReset,
  onResetPassword,
}: AuthScreenProps) {
  const [recoveryToken] = useState(readRecoveryToken);
  const [mode, setMode] = useState<AuthMode>(() => recoveryToken ? "reset" : "login");
  const [formError, setFormError] = useState("");
  const [devRole, setDevRoleValue] = useState(getDevRole);
  const submitted = useRef(false);
  const { locale } = useLocale();
  const text = (en: string, vi: string) => locale === "vi" ? vi : en;
  const developmentLogin = mode === "login" && isTeamDevAuth;

  useEffect(() => {
    if (!busy) submitted.current = false;
  }, [busy, error, notice]);

  useEffect(() => {
    if (recoveryToken) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [recoveryToken]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitted.current) return;
    submitted.current = true;
    if (developmentLogin) {
      onLogin({ email: "", password: "" });
      return;
    }
    const data = new FormData(event.currentTarget);
    if (mode === "reset") {
      const password = String(data.get("password") ?? "");
      if (password !== String(data.get("passwordConfirm") ?? "")) {
        setFormError(text("Passwords do not match.", "Hai mật khẩu không khớp."));
        submitted.current = false;
        return;
      }
      setFormError("");
      onResetPassword?.({ accessToken: recoveryToken, newPassword: password });
      return;
    }
    const email = String(data.get("email") ?? "")
      .trim()
      .toLowerCase();

    if (mode === "forgot") {
      onRequestPasswordReset(email);
      return;
    }

    if (mode === "register") {
      onRegister({
        name: String(data.get("name") ?? "New user").trim(),
        email,
        password: String(data.get("password") ?? ""),
        role: String(data.get("role") ?? "Scenario Engineer") as RegistrationRole,
      });
      return;
    }

    onLogin({
      email,
      password: String(data.get("password") ?? ""),
    });
  }

  return (
    <div className="auth-screen">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <section className="auth-showcase">
        <div className="brand auth-brand">
          <div className="brand-mark">
            <i />
            <i />
            <i />
          </div>
          <div>
            <strong>
              AutoScenario<span>X</span>
            </strong>
            <small>SIMULATION INTELLIGENCE</small>
          </div>
        </div>
        <div className="auth-showcase-copy">
          <span className="auth-eyebrow">
            <i /> AUTONOMOUS TESTING PLATFORM
          </span>
          <h1>
            Make every
            <br />
            <em>simulation</em> count.
          </h1>
          <p>
            Design high-value scenarios, run safety campaigns and understand
            every failure in one connected workspace.
          </p>
        </div>
        <div className="auth-preview-card">
          <div className="auth-preview-top">
            <span>
              <i /> DEMO CAMPAIGN
            </span>
            <b>68%</b>
          </div>
          <div className="auth-preview-track">
            <i />
          </div>
          <div className="auth-preview-bottom">
            <span>Night Drive Regression</span>
            <small>32 scenarios · 3 workers online</small>
          </div>
          <div className="auth-route-art">
            <svg viewBox="0 0 400 112" aria-hidden="true">
              <path
                d="M10 100C70 76 58 39 124 48s60 44 114 25 54-48 94-39 42 3 58-22"
                fill="none"
                stroke="rgba(52,35,39,.14)"
                strokeWidth="23"
                strokeLinecap="round"
              />
              <path
                d="M10 100C70 76 58 39 124 48s60 44 114 25 54-48 94-39 42 3 58-22"
                fill="none"
                stroke="#FF6363"
                strokeWidth="2.5"
                strokeDasharray="4 8"
                strokeLinecap="round"
              />
              <circle cx="10" cy="100" r="4" fill="#FF6363" />
              <circle cx="390" cy="12" r="6" fill="#FF6363" />
            </svg>
          </div>
        </div>
        <div className="auth-proof">
          <span>
            <Icon name="shield" size={16} /> Explainable safety results
          </span>
          <span>
            <Icon name="activity" size={16} /> CARLA-ready workflow
          </span>
        </div>
      </section>

      <section className="auth-panel-wrap">
        <LanguageSwitcher className="language-switch-auth" />
        <form className="auth-panel" onSubmit={submit} aria-busy={busy}>
          <div className="auth-mobile-brand brand">
            <div className="brand-mark">
              <i />
              <i />
              <i />
            </div>
            <div>
              <strong>
                AutoScenario<span>X</span>
              </strong>
              <small>SIMULATION INTELLIGENCE</small>
            </div>
          </div>
          <div className="auth-panel-head">
            <div className="auth-step">
              {mode === "login"
                ? "WELCOME BACK"
                : mode === "register"
                  ? "GET STARTED"
                  : "ACCOUNT RECOVERY"}
            </div>
            <h2>
              {mode === "login"
                ? developmentLogin ? text("Development workspace", "Không gian phát triển") : "Sign in to your workspace"
                : mode === "register"
                  ? text("Create your account", "Tạo tài khoản")
                  : mode === "reset" ? text("Choose a new password", "Đặt mật khẩu mới") : text("Recover your account", "Khôi phục tài khoản")}
            </h2>
            <p>
              {mode === "login"
                ? developmentLogin
                  ? text("Use the development account configured on the team backend. This mode does not verify a password.", "Sử dụng tài khoản phát triển được cấu hình ở backend nhóm. Chế độ này không kiểm tra mật khẩu.")
                  : text("Sign in with a Supabase account that has access to AutoScenarioX.", "Đăng nhập bằng tài khoản Supabase được cấp quyền vào AutoScenarioX.")
                : mode === "register"
                  ? text("Choose your workspace role. You may need to confirm your email before signing in.", "Chọn vai trò làm việc. Bạn có thể cần xác nhận email trước khi đăng nhập.")
                  : mode === "reset" ? text("Use this recovery link to set a new password.", "Sử dụng liên kết khôi phục này để đặt mật khẩu mới.") : text("Enter your email to request a password recovery link.", "Nhập email để nhận liên kết đặt lại mật khẩu.")}
            </p>
          </div>

          {mode === "register" && (
            <label className="auth-label">
              Full name
              <div className="auth-input">
                <Icon name="users" size={16} />
                <input
                  name="name"
                  disabled={busy}
                  required
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
            </label>
          )}
          {!developmentLogin && mode !== "reset" && <label className="auth-label">
            Work email
            <div className="auth-input">
              <Icon name="link" size={16} />
              <input
                name="email"
                disabled={busy}
                type="email"
                required
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
          </label>}
          {mode !== "forgot" && !developmentLogin && (
            <label className="auth-label">
              Password
              <div className="auth-input">
                <Icon name="shield" size={16} />
                <input
                  name="password"
                  disabled={busy}
                  type="password"
                  required
                  minLength={mode === "login" ? 1 : 8}
                  placeholder={mode === "login" ? "Your password" : "8+ characters"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              </div>
            </label>
          )}
          {mode === "reset" && <label className="auth-label">
            {text("Confirm new password", "Xác nhận mật khẩu mới")}
            <div className="auth-input"><Icon name="shield" size={16} /><input name="passwordConfirm" type="password" autoComplete="new-password" minLength={8} required disabled={busy} /></div>
          </label>}
          {mode === "login" && (
            <button
              className="auth-forgot"
              type="button"
              disabled={busy}
              onClick={() => {
                setMode("forgot");
              }}
            >
              Forgot password?
            </button>
          )}
          {mode === "register" && (
            <label className="auth-label">
              Role
              <select name="role" defaultValue="Scenario Engineer" required disabled={busy}>
                {registrationRoles.map((registrationRole) => (
                  <option key={registrationRole} value={registrationRole}>
                    {registrationRole}
                  </option>
                ))}
              </select>
            </label>
          )}
          {developmentLogin && <DevRoleSelect value={devRole} disabled={busy} onChange={role => { setDevRole(role); setDevRoleValue(role); }} />}
          {developmentLogin && <div className="auth-role-note" role="status">
            <Icon name="warning" size={15} />
            {text("Dev mode uses the backend development account with the temporary role selected above. It does not verify a password. Use Supabase mode for real sign-in.", "Chế độ Dev dùng tài khoản phát triển của backend với role tạm thời chọn phía trên. Chế độ này không kiểm tra mật khẩu. Dùng Supabase khi cần đăng nhập thật.")}
          </div>}
          {mode === "register" && (
            <div className="auth-role-note">
              <Icon name="shield" size={15} />
              Choose Scenario Engineer, Test Engineer, or Test Reviewer. Administrator access must be assigned by an existing administrator.
            </div>
          )}
          {(error || formError) && (
            <div className="auth-message auth-error" role="alert">
              <Icon name="warning" size={16} />
              {formError || error}
            </div>
          )}
          {notice && (
            <div className="auth-message" role="status">
              <Icon name="circle-check" size={16} />
              {notice}
            </div>
          )}
          <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
            {busy && <i className="button-spinner" aria-hidden="true" />}
            {busy
              ? "Please wait…"
              : mode === "login"
                ? developmentLogin ? text("Open development workspace", "Mở không gian phát triển") : "Sign in"
                : mode === "register"
                  ? text("Create account", "Tạo tài khoản")
                  : mode === "reset" ? text("Set new password", "Đặt mật khẩu mới") : text("Send recovery link", "Gửi liên kết khôi phục")}
            {!busy && <Icon name="arrow-right" size={16} />}
          </button>
          <div className="auth-switch">
            {mode === "login" ? (
              <>
                New to AutoScenarioX?{" "}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMode("register");
                  }}
                >
                  {text("Create account", "Tạo tài khoản")}
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMode("login");
                  }}
                >
                  Back to sign in
                </button>
              </>
            )}
          </div>
          <div className="auth-footnote">
            <i /> {developmentLogin ? text("Development access · Backend account", "Truy cập phát triển · Tài khoản backend") : "Secure sign-in · Role-based access"}
          </div>
        </form>
      </section>
    </div>
  );
}
