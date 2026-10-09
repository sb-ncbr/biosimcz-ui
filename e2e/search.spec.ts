import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Anonymous on purpose: nothing here signs in. `/records` is the dataset search, `/` the homepage with a hero search over the MDposit mock (src/mocks/fixtures/mdpositProjects.ts).

const POPC = "POPC membrane with cholesterol, 1 µs";
const DPPC = "DPPC bilayer phase transition";

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

// Below lg the facets live in a sheet behind "Filters".
const openFiltersIfCollapsed = async (page: Page): Promise<boolean> => {
  const trigger = page.getByRole("button", { name: /^Filters/ });
  if (!(await trigger.isVisible())) return false;
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return true;
};

const card = (page: Page, title: string) => page.getByRole("heading", { level: 2, name: title });

test("search from the homepage hero lands on /records, then open a simulation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Repository of computational chemistry experiments" })).toBeVisible();
  await expect(page.getByText("published simulations")).toContainText("25");
  await checkPage(page, "home");

  const hero = page.getByRole("main").getByRole("search");
  await hero.getByRole("searchbox", { name: "Search records" }).fill("membrane");
  await hero.getByRole("button", { name: "Search" }).click();
  await page.waitForURL(/\/records\?q=membrane$/);
  await expect(page.getByRole("heading", { level: 1, name: "Repository of molecular dynamics simulations" })).toBeVisible();
  await expect(card(page, POPC)).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search records" })).toHaveValue("membrane");
  await checkPage(page, "results");

  await page.getByRole("link", { name: POPC }).click();
  // waitForURL: under next dev the first visit to a route compiles it, which can outlast the 5 s expect timeout.
  await page.waitForURL(/\/records\/MD-A00005$/);
  await expect(page.getByRole("heading", { level: 1, name: POPC })).toBeVisible();
});

test("a filter and a sort go to the API, live in the URL and keep the query", async ({ page }) => {
  await page.goto("/records?q=membrane");
  await expect(card(page, DPPC)).toBeVisible();

  await page.getByRole("combobox", { name: "Sort by" }).click();
  await page.getByRole("option", { name: "Newest first" }).click();
  await expect(page).toHaveURL(/q=membrane/);
  await expect(page).toHaveURL(/sort=newest/);
  // Radix hands focus back to the trigger when the select closes; opening the sheet before that would dismiss it.
  await expect(page.getByRole("combobox", { name: "Sort by" })).toBeFocused();

  const inSheet = await openFiltersIfCollapsed(page);
  await page.getByRole("checkbox", { name: "GROMACS", exact: true }).check();
  await expect(page).toHaveURL(/software=GROMACS/);
  if (inSheet) await page.keyboard.press("Escape");

  // The Amber record no longer matches, the GROMACS one still does.
  await expect(card(page, POPC)).toBeVisible();
  await expect(card(page, DPPC)).toHaveCount(0);
  await expect(page.getByText("Engine: GROMACS")).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/software=GROMACS/);
  await expect(page.getByRole("combobox", { name: "Sort by" })).toContainText("Newest first");
  await expect(page.getByText("Engine: GROMACS")).toBeVisible();

  await page.getByRole("button", { name: "Remove filter Engine: GROMACS" }).click();
  await expect(page).not.toHaveURL(/software=/);
  await expect(card(page, DPPC)).toBeVisible();
});

test("the page size and pagination work", async ({ page }) => {
  await page.goto("/records");
  await expect(page.getByRole("combobox", { name: "Per page" })).toContainText("20 per page");
  await page.getByRole("combobox", { name: "Per page" }).click();
  await page.getByRole("option", { name: "10 per page" }).click();
  await expect(page).toHaveURL(/size=10/);
  await expect(page.getByTestId("record-card")).toHaveCount(10);

  await page.getByRole("navigation", { name: "Pagination" }).getByRole("link", { name: "2", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/size=10/);
  await expect(page.getByTestId("record-card")).toHaveCount(10);
  await checkPage(page, "page-2");
});

test("a query without matches offers a way out", async ({ page }) => {
  await page.goto("/records?q=zzzzqqq");
  await expect(page.getByRole("heading", { name: "No records match" })).toBeVisible();
  await checkPage(page, "no-results");

  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(page).toHaveURL(/\/records$/);
  await expect(page.getByTestId("record-card").first()).toBeVisible();
});

test("/records is the search and old URLs redirect to it with their parameters", async ({ page }) => {
  await page.goto("/records?q=lysozyme");
  await expect(page).toHaveURL(/\/records\?q=lysozyme$/);
  await expect(card(page, "Hen egg-white lysozyme in water, 100 ns")).toBeVisible();

  await page.goto("/records-list?q=lysozyme&software=GROMACS");
  await expect(page).toHaveURL(/\/records\?q=lysozyme&software=GROMACS$/);
  await expect(page.getByText("Engine: GROMACS")).toBeVisible();

  await page.goto("/records/MD-A00005/overview");
  await expect(page).toHaveURL(/\/records\/MD-A00005$/);
});

test("an unknown record gives the not-found page, and the app bar search still works", async ({ page }) => {
  await page.goto("/records/does-not-exist");
  await expect(page.getByRole("heading", { name: "Record not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Search simulations" })).toBeVisible();
  await checkPage(page, "record-not-found");
});

test("the app bar offers search from other pages", async ({ page }) => {
  await page.goto("/records/does-not-exist");
  const width = page.viewportSize()?.width ?? 0;
  const header = page.locator("header");
  if (width < 768) {
    await expect(header.getByRole("search")).toBeHidden();
    return;
  }
  // The bar is full between lg and 2xl: no field there, the Browse link leads to the search page.
  if (width >= 1024 && width < 1536) {
    await expect(header.getByRole("search")).toBeHidden();
    await header.getByRole("link", { name: "Browse" }).click();
    await page.waitForURL(/\/records$/);
    return;
  }
  const field = header.getByRole("search").getByRole("searchbox", { name: "Search records" });
  await field.fill("lysozyme");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/records\?q=lysozyme$/);
  await expect(card(page, "Hen egg-white lysozyme in water, 100 ns")).toBeVisible();
});
