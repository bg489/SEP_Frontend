import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { LanguageSwitcher } from "../i18n";
import type { LoginInput, RegisterInput, RegistrationRole } from "../services/authApi";

type AuthMode = "login" | "register" | "forgot";

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
}

export function AuthScreen({
  busy,
  error,
  notice,
  onLogin,
  onRegister,
  onRequestPasswordReset,
}: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const submitted = useRef(false);

  useEffect(() => {
    if (!busy) submitted.current = false;
  }, [busy, error, notice]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitted.current) return;
    submitted.current = true;
    const data = new FormData(event.currentTarget);
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
              <i /> LIVE CAMPAIGN
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
                ? "Sign in to your workspace"
                : mode === "register"
                  ? "Create your account"
                  : "Reset your password"}
            </h2>
            <p>
              {mode === "login"
                ? "Sign in with an account registered in the AutoScenarioX database."
                : mode === "register"
                  ? "Create an account with your work email and choose your role. Administrator access is assigned separately."
                  : "Enter your email and we’ll prepare a reset request."}
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
          <label className="auth-label">
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
          </label>
          {mode !== "forgot" && (
            <label className="auth-label">
              Password
              <div className="auth-input">
                <Icon name="shield" size={16} />
                <input
                  name="password"
                  disabled={busy}
                  type="password"
                  required
                  minLength={8}
                  placeholder="8+ characters with upper/lowercase, number and symbol"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              </div>
            </label>
          )}
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
          {mode === "register" && (
            <div className="auth-role-note">
              <Icon name="shield" size={15} />
              Choose Scenario Engineer, Test Engineer, or Test Reviewer. Administrator access must be assigned by an existing administrator.
            </div>
          )}
          {error && (
            <div className="auth-message auth-error" role="alert">
              <Icon name="warning" size={16} />
              {error}
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
                ? "Sign in"
                : mode === "register"
                  ? "Create account"
                  : "Send reset link"}
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
                  Create an account
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
            <i /> Secure sign-in · Role-based access
          </div>
        </form>
      </section>
    </div>
  );
}
