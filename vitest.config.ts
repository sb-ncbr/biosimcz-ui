import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    // next-auth imports next/headers without an extension, which Node ESM cannot resolve; Vite can.
    server: { deps: { inline: ["next-auth"] } },
    projects: [
      {
        extends: true,
        test: { name: "node", environment: "node", include: ["src/**/*.node.test.ts"], setupFiles: ["./vitest.setup.ts"] },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts", "./vitest.setup.dom.ts"],
        },
      },
    ],
  },
});
