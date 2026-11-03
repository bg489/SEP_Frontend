import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/tests/**/*.test.{ts,tsx}"],
    env: { VITE_AUTH_MODE: "Supabase", VITE_DATA_MODE: "api" },
    reporters: ["default", ["junit", { outputFile: "reports/unit-junit.xml" }]],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/features/**/*.ts", "src/hooks/*.ts", "src/services/*.ts", "src/components/AuthScreen.tsx", "src/components/AccountSettings.tsx"],
      exclude: ["src/services/mockApi.ts", "src/services/workflowStore.ts"],
    },
  },
});
