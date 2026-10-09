import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

const layers = (types) => ({ element: { types: { anyOf: types } } });

// Library churn stays in two places: Auth.js in the auth/session server folders, jose in the mock IdP.
// Viewer libraries (molstar, echarts) are likewise confined to their own folders under shared/viewers.
const restrictedImports = ({ authJs, jose, molstar, echarts }) => [
  "error",
  {
    paths: [
      { name: "axios", message: "Use fetch." },
      ...(molstar ? [] : [{ name: "molstar", message: "Import only through shared/viewers/molstar." }]),
      ...(echarts ? [] : [{ name: "echarts", message: "Import only through shared/viewers/echarts." }]),
      { name: "next-auth/react", message: "No client session: sign-in and sign-out are server actions (plan oidc-auth R3)." },
      ...(jose ? [] : [{ name: "jose", message: "jose is for the mock IdP in src/mocks only." }]),
    ],
    patterns: [
      {
        // A feature is used through its barrel (index.ts) or its server entry point, never by reaching into its folders.
        group: ["@/features/*/*", "!@/features/*/server"],
        message: "No deep imports into another feature. Import from the feature barrel, or move shared code to entities or shared.",
      },
      ...(molstar ? [] : [{ group: ["molstar/*"], message: "Import molstar subpaths only inside shared/viewers/molstar." }]),
      ...(echarts ? [] : [{ group: ["echarts/*"], message: "Import echarts subpaths only inside shared/viewers/echarts." }]),
      ...(authJs ? [] : [{ group: ["next-auth", "next-auth/*"], message: "Auth.js is imported only in src/server/auth, src/server/session, src/proxy.ts and src/app/api/auth." }]),
    ],
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**" },
        { type: "widgets", pattern: "src/widgets/**" },
        { type: "features", pattern: "src/features/**" },
        { type: "entities", pattern: "src/entities/**" },
        { type: "shared", pattern: "src/shared/**" },
        { type: "server", pattern: "src/server/**" },
      ],
    },
    rules: {
      // app -> widgets -> features -> entities -> shared; server is reachable from app and features only.
      "boundaries/dependencies": [
        2,
        {
          default: "disallow",
          policies: [
            { from: { element: { type: "app" } }, allow: { to: layers(["app", "widgets", "features", "entities", "shared", "server"]) } },
            { from: { element: { type: "widgets" } }, allow: { to: layers(["widgets", "features", "entities", "shared", "server"]) } },
            { from: { element: { type: "features" } }, allow: { to: layers(["features", "entities", "shared", "server"]) } },
            { from: { element: { type: "entities" } }, allow: { to: layers(["entities", "shared"]) } },
            { from: { element: { type: "shared" } }, allow: { to: layers(["shared"]) } },
            { from: { element: { type: "server" } }, allow: { to: layers(["server", "entities", "shared"]) } },
          ],
        },
      ],
      "no-console": "error",
      "no-restricted-properties": [
        "error",
        { object: "document", property: "cookie", message: "Session lives in an httpOnly cookie handled on the server." },
      ],
      "no-restricted-imports": restrictedImports({ authJs: false, jose: false }),
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/(?:bg|text|border|fill|stroke|ring|from|to|via)-\\[#/]",
          message: "No arbitrary hex colours; use design-system tokens.",
        },
      ],
    },
  },
  {
    files: ["src/server/auth/**", "src/server/session/**", "src/proxy.ts", "src/app/api/auth/**", "src/test/**"],
    rules: { "no-restricted-imports": restrictedImports({ authJs: true, jose: false }) },
  },
  {
    files: ["src/shared/viewers/molstar/**"],
    rules: { "no-restricted-imports": restrictedImports({ authJs: false, jose: false, molstar: true }) },
  },
  {
    files: ["src/shared/viewers/echarts/**"],
    rules: { "no-restricted-imports": restrictedImports({ authJs: false, jose: false, echarts: true }) },
  },
  {
    files: ["src/mocks/**"],
    rules: { "no-restricted-imports": restrictedImports({ authJs: false, jose: true }) },
  },
  {
    files: ["src/server/lib/logger.ts", "scripts/**", "src/mocks/**"],
    rules: { "no-console": "off" },
  },
  globalIgnores([".next/**", ".next-e2e/**", "out/**", "build/**", "next-env.d.ts", "coverage/**", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
