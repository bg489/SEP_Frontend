import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { DemoUser, UserRole } from "../../types";
import type { AdminUser, AuthSession, LoginInput, RegisterInput } from "../../services/authApi";

export type AuthStatus = "checking" | "anonymous" | "authenticated";

interface AuthState {
  status: AuthStatus;
  user: DemoUser | null;
  busy: boolean;
  error: string | null;
  message: string | null;
  adminUsers: AdminUser[];
  adminUsersBusy: boolean;
  adminUsersError: string | null;
}

const initialState: AuthState = {
  status: "checking",
  user: null,
  busy: false,
  error: null,
  message: null,
  adminUsers: [],
  adminUsersBusy: false,
  adminUsersError: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    bootstrapAuthRequested(state) {
      state.status = "checking";
    },
    authAnonymous(state) {
      state.status = "anonymous";
      state.user = null;
      state.busy = false;
    },
    loginRequested(state, _action: PayloadAction<LoginInput>) {
      state.busy = true;
      state.error = null;
      state.message = null;
    },
    registerRequested(state, _action: PayloadAction<RegisterInput>) {
      state.busy = true;
      state.error = null;
      state.message = null;
    },
    passwordResetRequested(state, _action: PayloadAction<string>) {
      state.busy = true;
      state.error = null;
      state.message = null;
    },
    authSucceeded(state, action: PayloadAction<AuthSession>) {
      state.status = "authenticated";
      state.user = action.payload.user;
      state.busy = false;
      state.error = null;
      state.message = null;
    },
    authFailed(state, action: PayloadAction<string>) {
      state.status = "anonymous";
      state.busy = false;
      state.error = action.payload;
    },
    passwordResetSucceeded(state, action: PayloadAction<string>) {
      state.busy = false;
      state.error = null;
      state.message = action.payload;
    },
    logoutRequested(state) {
      state.busy = true;
      state.error = null;
    },
    signedOut(state) {
      state.status = "anonymous";
      state.user = null;
      state.busy = false;
      state.error = null;
      state.message = null;
    },
    adminUsersRequested(state) {
      state.adminUsersBusy = true;
      state.adminUsersError = null;
    },
    adminUsersLoaded(state, action: PayloadAction<AdminUser[]>) {
      state.adminUsers = action.payload;
      state.adminUsersBusy = false;
      state.adminUsersError = null;
    },
    adminRoleChangeRequested(state, _action: PayloadAction<{ id: string; role: UserRole }>) {
      state.adminUsersBusy = true;
      state.adminUsersError = null;
    },
    adminUserRoleChanged(state, action: PayloadAction<AdminUser>) {
      state.adminUsers = state.adminUsers.map((user) =>
        user.id === action.payload.id ? action.payload : user,
      );
      state.adminUsersBusy = false;
      state.adminUsersError = null;
    },
    adminUsersFailed(state, action: PayloadAction<string>) {
      state.adminUsersBusy = false;
      state.adminUsersError = action.payload;
    },
  },
});

export const {
  authAnonymous,
  authFailed,
  authSucceeded,
  adminRoleChangeRequested,
  adminUserRoleChanged,
  adminUsersFailed,
  adminUsersLoaded,
  adminUsersRequested,
  bootstrapAuthRequested,
  loginRequested,
  logoutRequested,
  passwordResetRequested,
  passwordResetSucceeded,
  registerRequested,
  signedOut,
} = authSlice.actions;

export default authSlice.reducer;
