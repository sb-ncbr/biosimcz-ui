import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // The e2e run builds into its own dir so it never collides with a developer's `next dev` on .next (and its lock).
  distDir: process.env["NEXT_DIST_DIR"] || ".next",
  // Server function arguments (form data, draft content) stay private: sign-in carries no secrets any more, but drafts are unpublished work.
  logging: { serverFunctions: false },
  transpilePackages: ["@e-infra/design-system"],
  // The dataset search lives at /records; old links keep working and the query string is passed through to the destination.
  async redirects() {
    return [
      { source: "/records-list", destination: "/records", permanent: true },
      { source: "/records/:id/overview", destination: "/records/:id", permanent: false },
    ];
  },
};

export default nextConfig;
