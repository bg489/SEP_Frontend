import { useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { LanguageSwitcher } from "../i18n";
import type { DemoUser, UserRole } from "../types";

type AuthMode = "login" | "register" | "forgot";

const demoAccounts: DemoUser[] = [
  {
    name: "Linh Nguyen",
    email: "scenario@autoscenariox.dev",
    role: "Scenario Engineer",
  },
  {
    name: "Bao Doan",
    email: "tester@autoscenariox.dev",
    role: "Test Engineer",
  },
  {
    name: "Mai Tran",
    email: "reviewer@autoscenariox.dev",
    role: "Test Reviewer",
  },
  {
    name: "Alex Pham",
    email: "admin@autoscenariox.dev",
    role: "Administrator",
  },
];

const roles: UserRole[] = [
  "Scenario Engineer",
  "Test Engineer",
  "Test Reviewer",
  "Administrator",
];

export function AuthScreen({
  onAuthenticate,
}: {
  onAuthenticate: (user: DemoUser) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState<UserRole>("Test Engineer");
  const [message, setMessage] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "")
      .trim()
      .toLowerCase();

    if (mode === "forgot") {
      setMessage(
        `A password reset link is ready to send to ${email} when authentication is connected.`,
      );
      return;
    }

    if (mode === "register") {
      const user: DemoUser = {
        name: String(data.get("name") ?? "New user").trim(),
        email,
        role,
      };
      const saved = JSON.parse(
        localStorage.getItem("asx-users") ?? "[]",
      ) as DemoUser[];
      localStorage.setItem(
        "asx-users",
        JSON.stringify([user, ...saved.filter((item) => item.email !== email)]),
      );
      onAuthenticate(user);
      return;
    }

    const known = demoAccounts.find((item) => item.email === email);
    const saved = JSON.parse(
      localStorage.getItem("asx-users") ?? "[]",
    ) as DemoUser[];
    const registered = saved.find((item) => item.email === email);
    const user = registered ??
      known ?? {
        name:
          email
            .split("@")[0]
            ?.replace(/[._-]/g, " ")
            .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "Demo user",
        email: email || "demo@autoscenariox.dev",
        role,
      };
    onAuthenticate({ ...user, role: known?.role ?? registered?.role ?? role });
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
        <form className="auth-panel" onSubmit={submit}>
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
                ? "Enter your details or use a demo role to explore AutoScenarioX."
                : mode === "register"
                  ? "Set up a demo profile. Authentication will connect to your backend later."
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
                  type="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              </div>
            </label>
          )}
          {mode !== "forgot" && (
            <label className="auth-label">
              Preview role
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole)}
              >
                {roles.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          )}
          {mode === "login" && (
            <button
              className="auth-forgot"
              type="button"
              onClick={() => {
                setMessage("");
                setMode("forgot");
              }}
            >
              Forgot password?
            </button>
          )}
          {message && (
            <div className="auth-message">
              <Icon name="circle-check" size={16} />
              {message}
            </div>
          )}
          <button className="btn btn-primary auth-submit" type="submit">
            {mode === "login"
              ? "Sign in"
              : mode === "register"
                ? "Create account"
                : "Send reset link"}
            <Icon name="arrow-right" size={16} />
          </button>
          <div className="auth-switch">
            {mode === "login" ? (
              <>
                New to AutoScenarioX?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMessage("");
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
                  onClick={() => {
                    setMessage("");
                    setMode("login");
                  }}
                >
                  Back to sign in
                </button>
              </>
            )}
          </div>
          {mode === "login" && (
            <>
              <div className="auth-divider">
                <span />
                or explore a role
                <span />
              </div>
              <div className="demo-role-grid">
                {demoAccounts.map((account, index) => (
                  <button
                    type="button"
                    key={account.role}
                    className="demo-role"
                    onClick={() => onAuthenticate(account)}
                  >
                    <span className={`demo-role-avatar tone-${index}`}>
                      {account.name
                        .split(" ")
                        .map((part) => part[0])
                        .join("")}
                    </span>
                    <span>
                      <b>{account.role}</b>
                      <small>{account.name}</small>
                    </span>
                    <Icon name="arrow-right" size={14} />
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="auth-footnote">
            <i /> Demo data only · No backend authentication is connected
          </div>
        </form>
      </section>
    </div>
  );
}
