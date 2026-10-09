import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support/signIn";

// The MVP journey: anonymous search from the homepage hero (results on /records), open a record, then sign in and reach My depositions.

const checkPage = async (page: Page, name: string): Promise<void> => {
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(overflow.scroll, `${name}: horizontal scroll`).toBeLessThanOrEqual(overflow.inner);
  const { violations } = await new AxeBuilder({ page }).analyze();
  const bad = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0]?.html.slice(0, 120)}`);
  expect(bad, `${name}: axe`).toEqual([]);
};

const RECORD = "POPC membrane with cholesterol, 1 µs";

const searchFromHome = async (page: Page): Promise<void> => {
  await page.goto("/");
  const hero = page.getByRole("main").getByRole("search");
  await hero.getByRole("searchbox", { name: "Search records" }).fill("POPC");
  await hero.getByRole("searchbox", { name: "Search records" }).press("Enter");
  await expect(page).toHaveURL(/\/records\?q=POPC$/);
  // The web font swaps in after the first paint and re-wraps the heading on phones, which moves the card under the cursor.
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: RECORD }).click();
  // waitForURL, not toHaveURL: under next dev the first visit compiles the route, which outlasts the 5 s expect timeout.
  await page.waitForURL(/\/records\/MD-A00005$/);
};

test("anonymous visitor searches from the homepage and opens a record", async ({ page }) => {
  await searchFromHome(page);
  await expect(page.getByRole("heading", { level: 1, name: RECORD })).toBeVisible();
  await expect(page.getByText("MD-A00005", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Simulation details" }).getByText("GROMACS 2024.1")).toBeVisible();
  await expect(page.getByRole("region", { name: "Contributors" }).getByRole("link", { name: "data@example.org" })).toHaveAttribute("href", "mailto:data@example.org");
  const facts = page.getByRole("complementary", { name: "Record" });
  await expect(facts.getByRole("button", { name: "View 3D structure" })).toBeVisible();
  await expect(facts.getByRole("button", { name: "Copy citation" })).toBeVisible();
  // Sections without data (the membrane has no sequence) are left out, not shown empty.
  await expect(page.getByRole("region", { name: "Sequences" })).toHaveCount(0);
  const files = page.getByRole("region", { name: "Files" }).getByRole("table");
  await expect(files.getByText("topology.top")).toBeVisible();
  await expect(files.getByText("popc-chol.xtc")).toBeVisible();
  await checkPage(page, "record");
});

test("a visitor signs in after reading a record and reaches My depositions", async ({ page }) => {
  await searchFromHome(page);
  // signIn lands on the page given by "next"; the record the visitor was reading stays reachable afterwards.
  await signIn(page, "/records/MD-A00005");
  await expect(page).toHaveURL(/\/records\/MD-A00005$/);
  await expect(page.getByRole("heading", { level: 1, name: RECORD })).toBeVisible();

  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole("dialog").getByRole("link", { name: "My depositions" }).click();
  } else {
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "My depositions" }).click();
  }
  await expect(page).toHaveURL(/\/depositions$/);
  await expect(page.getByRole("heading", { level: 1, name: "My depositions" })).toBeVisible();
});
