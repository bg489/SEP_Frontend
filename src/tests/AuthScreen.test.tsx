import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthScreen } from "../components/AuthScreen";
import { LocaleContext } from "../localeContext";

function mount(busy = false) {
  const props = { busy, error: null, notice: null, onLogin: vi.fn(), onRegister: vi.fn(), onRequestPasswordReset: vi.fn(), onResetPassword: vi.fn() };
  render(<StrictMode><LocaleContext.Provider value={{ locale: "en", setLocale: vi.fn() }}><AuthScreen {...props} /></LocaleContext.Provider></StrictMode>);
  return props;
}
describe("Account forms", () => {
  it("FE-UT-055 repeated submits dispatch only one request before loading renders", () => {
    const props = mount(); const button = screen.getByRole("button", { name: /^Sign in$/ }); const form = button.closest("form")!;
    fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "USER@example.invalid" } }); fireEvent.change(screen.getByLabelText("Password", { exact: true }), { target: { value: "fixture-password" } });
    fireEvent.submit(form); fireEvent.submit(form); expect(props.onLogin).toHaveBeenCalledTimes(1);
    expect(props.onLogin).toHaveBeenCalledWith({ email: "user@example.invalid", password: "fixture-password" });
  });
  it("registration offers all three non-Admin roles and sends the chosen role", async () => {
    const props = mount(); const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Create account" }));
    const roles = screen.getByRole("combobox", { name: "Role" });
    expect(Array.from((roles as HTMLSelectElement).options).map(o => o.value)).toEqual(["Scenario Engineer", "Test Engineer", "Test Reviewer"]);
    await user.type(screen.getByLabelText("Full name"), "New Reviewer"); await user.type(screen.getByLabelText("Work email"), "new@example.invalid");
    await user.type(screen.getByLabelText("Password", { exact: true }), "fixture-password"); await user.selectOptions(roles, "Test Reviewer");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(props.onRegister).toHaveBeenCalledWith({ name: "New Reviewer", email: "new@example.invalid", password: "fixture-password", role: "Test Reviewer" });
  });
  it("busy authentication disables fields and submission", () => {
    const props = mount(true); const button = screen.getByRole("button", { name: "Please wait…" }); expect(button).toBeDisabled();
    fireEvent.submit(button.closest("form")!); expect(props.onLogin).not.toHaveBeenCalled(); expect(screen.getByLabelText("Work email")).toBeDisabled();
  });
  it("recovery token survives StrictMode and is removed from the URL", async () => {
    window.history.replaceState(null, "", "/#type=recovery&access_token=fixture-recovery-token");
    const props = mount(); expect(window.location.hash).toBe(""); const user = userEvent.setup();
    await user.type(screen.getByLabelText("Password", { exact: true }), "new-fixture-password");
    await user.type(screen.getByLabelText("Confirm new password"), "different-password");
    await user.click(screen.getByRole("button", { name: "Set new password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Passwords do not match"); expect(props.onResetPassword).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Confirm new password")); await user.type(screen.getByLabelText("Confirm new password"), "new-fixture-password");
    await user.click(screen.getByRole("button", { name: "Set new password" }));
    expect(props.onResetPassword).toHaveBeenCalledWith({ accessToken: "fixture-recovery-token", newPassword: "new-fixture-password" });
  });
});
