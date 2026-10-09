import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// MD-A007L3 is the captured live record (4 replicas, 21 analysis names each); MD-A00005 is a sanitized record whose replicas have no analyses.
const RICH = "/records/MD-A007L3/experiments";
const BARE = "/records/MD-A00005/experiments";

const expectNoSeriousViolations = async (page: Page, name: string): Promise<void> => {
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page }).analyze();
  const bad = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0]?.html.slice(0, 120)}`);
  expect(bad, `${name}: axe`).toEqual([]);
};

// Under next dev the first visit of a route compiles it, which outlasts the 5 s expect timeout.
const open = async (page: Page, path: string, pattern: RegExp): Promise<void> => {
  await page.goto(path);
  await page.waitForURL(pattern);
};

// The rail is hidden below lg and replaced by a Select; this returns whichever navigation is visible.
const replicaLink = (page: Page, name: string) => page.getByRole("navigation", { name: "Replicas" }).getByRole("link", { name, exact: true });

const hasRail = (page: Page): boolean => (page.viewportSize()?.width ?? 0) >= 1024;

test("the experiments index redirects to the first replica overview with an encoded name", async ({ page }) => {
  await open(page, BARE, /\/records\/MD-A00005\/experiments\/replica%201\/overview$/);
  await expect(page.getByRole("navigation", { name: "Replica sections" }).getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await expectNoSeriousViolations(page, "bare overview");
});

test("tabs are links and only the current one has aria-current", async ({ page }) => {
  await open(page, `${RICH}/replica_1/overview`, /replica_1\/overview$/);
  const tabs = page.getByRole("navigation", { name: "Replica sections" });
  for (const [label, segment] of [
    ["Overview", "overview"],
    ["Trajectory", "trajectory"],
    ["Analyses", "analyses"],
  ] as const) {
    await expect(tabs.getByRole("link", { name: label })).toHaveAttribute("href", new RegExp(`/replica_1/${segment}$`));
  }
  await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Trajectory" })).not.toHaveAttribute("aria-current", "page");

  await tabs.getByRole("link", { name: "Trajectory" }).click();
  await page.waitForURL(/replica_1\/trajectory$/);
  await expect(tabs.getByRole("link", { name: "Trajectory" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current", "page");
});

test("overview shows the simulation length and passes axe", async ({ page }) => {
  await open(page, `${RICH}/replica_1/overview`, /replica_1\/overview$/);
  await expect(page.getByText("Simulation length")).toBeVisible();
  await expect(page.getByText("2,503.1 ns")).toBeVisible();
  await expectNoSeriousViolations(page, "overview");
  await page.screenshot({ path: test.info().outputPath("overview.png"), fullPage: true });
  await test.info().attach("overview", { path: test.info().outputPath("overview.png"), contentType: "image/png" });
});

test("switching replica keeps the Trajectory tab", async ({ page }) => {
  test.skip(!hasRail(page), "the replica rail shows from 1024 px; the phone select is covered by the unit tests");
  await open(page, `${RICH}/replica_1/trajectory`, /replica_1\/trajectory$/);
  await replicaLink(page, "replica_2").click();
  await page.waitForURL(/replica_2\/trajectory$/);
  await expect(page.getByRole("navigation", { name: "Replica sections" }).getByRole("link", { name: "Trajectory" })).toHaveAttribute("aria-current", "page");
  await expect(replicaLink(page, "replica_2")).toHaveAttribute("aria-current", "page");
});

test("switching replica keeps an analysis that exists on both", async ({ page }) => {
  test.skip(!hasRail(page), "the replica rail shows from 1024 px; the phone select is covered by the unit tests");
  await open(page, `${RICH}/replica_1/analyses/rmsds`, /replica_1\/analyses\/rmsds$/);
  await expect(replicaLink(page, "replica_3")).toHaveAttribute("href", /replica_3\/analyses\/rmsds$/);
  await replicaLink(page, "replica_3").click();
  await page.waitForURL(/replica_3\/analyses\/rmsds$/);
});

test("an unknown replica shows the not-found page without a spinner", async ({ page }) => {
  await page.goto(`${RICH}/no_such_replica/overview`);
  await expect(page.getByRole("heading", { level: 1, name: "Replica not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Search simulations" })).toBeVisible();
  await expect(page.locator("[aria-busy='true']")).toHaveCount(0);
  await expectNoSeriousViolations(page, "not found");
});

test("the analyses index goes to the first analysis", async ({ page }) => {
  await open(page, `${RICH}/replica_1/analyses`, /replica_1\/analyses\/[a-z0-9-]+$/);
  await expect(page.getByRole("navigation", { name: "Replica sections" }).getByRole("link", { name: "Analyses" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("combobox", { name: "Analysis type" })).toBeVisible();
  await expectNoSeriousViolations(page, "analyses index");
});

test("a replica without analyses shows the empty state", async ({ page }) => {
  await page.goto(`${BARE}/replica%201/analyses`);
  await expect(page.getByRole("heading", { name: "No analyses for this replica" })).toBeVisible();
  await expect(page).toHaveURL(/replica%201\/analyses$/);
  await expectNoSeriousViolations(page, "no analyses");
});
