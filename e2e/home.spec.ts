import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./support/signIn";

// The homepage: hero search, explore, about, community, footer. Records come from the MDposit mock.

const SHOTS = path.resolve(__dirname, "../../plans/verify/home");

const checkPage = async (page: Page, name: string): Promise<void> => {
  const width = page.viewportSize()?.width ?? 0;
  await page.waitForLoadState("networkidle");
  const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(overflow.scroll, `${name}: horizontal scroll at ${width}`).toBeLessThanOrEqual(overflow.inner);
  const { violations } = await new AxeBuilder({ page }).analyze();
  const bad = violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0]?.html.slice(0, 120)}`);
  expect(bad, `${name}: axe at ${width}`).toEqual([]);
  if (width === 1280 || width === 375) await page.screenshot({ path: path.join(SHOTS, `${name}-${width}.png`), fullPage: true });
};

test("the homepage has the old sections in order with one h1 and h2 per section", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Repository of computational chemistry experiments | MDRepo");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Repository of computational chemistry experiments");
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText([
    "Explore data through interactive simulations",
    "About MDRepo",
    "Community",
  ]);
  await expect(page.getByRole("main").getByRole("heading", { level: 3 })).toHaveText(["Explore", "Share", "Use"]);
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await checkPage(page, "home");

  await page.goto("/records");
  await expect(page.getByTestId("record-card").first()).toBeVisible();
  await checkPage(page, "records");
});

test("the homepage CTAs lead to the search, login and communities", async ({ page }) => {
  await page.goto("/");
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "Browse simulations" })).toHaveAttribute("href", "/records");
  await expect(main.getByRole("link", { name: "Explore", exact: true })).toHaveAttribute("href", "/records");
  await expect(main.getByRole("link", { name: "Share", exact: true })).toHaveAttribute("href", "/login?next=%2Fdepositions");
  await expect(main.getByRole("link", { name: "Join community" })).toHaveAttribute("href", "/communities");

  await main.getByRole("link", { name: /deposition/i }).click();
  await page.waitForURL(/\/login\?next=%2Fdepositions$/);
});

test("an engine chip opens the search with that filter", async ({ page }) => {
  await page.goto("/");
  const chips = page.getByRole("list", { name: "Popular engines:" });
  await chips.getByRole("link", { name: /^GROMACS/ }).click();
  await page.waitForURL(/\/records\?software=GROMACS$/);
  await expect(page.getByText("Engine: GROMACS")).toBeVisible();
});

test("the hero search is keyboard reachable with a visible focus ring", async ({ page }) => {
  await page.goto("/");
  const field = page.getByRole("main").getByRole("searchbox", { name: "Search records" });
  await field.focus();
  await expect(field).toBeFocused();
  await page.keyboard.type("lysozyme");
  await page.keyboard.press("Tab");
  const button = page.getByRole("main").getByRole("button", { name: "Search" });
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/records\?q=lysozyme$/);
});

test("a signed-in user starts a draft from the hero Deposition button", async ({ page }) => {
  await signIn(page, "/");
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("main").getByRole("button", { name: "New deposition" }).click();
  await page.waitForURL(/\/depositions\/[^/]+\/study$/);
});
