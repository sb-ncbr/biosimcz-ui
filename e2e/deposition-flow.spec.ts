import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn, signOut } from "./support/signIn";

const SHOTS = path.resolve(__dirname, "../../plans/verify/p4");

const consoleErrors = new WeakMap<Page, string[]>();

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  consoleErrors.set(page, errors);
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`${message.text()} @ ${page.url()} ${JSON.stringify(message.location())}`);
  });
  page.on("pageerror", (error) => errors.push(error.message));
});

const checkPage = async (page: Page, name: string): Promise<void> => {
  const width = page.viewportSize()?.width ?? 0;
  await page.waitForLoadState("networkidle");
  // Radix leaves aria-hidden on siblings and a closing listbox in the DOM until exit animations end.
  await expect(page.locator("body > [aria-hidden=true]:not(script)")).toHaveCount(0);
  await expect(page.locator("[role=listbox][data-state=closed]")).toHaveCount(0);
  const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(overflow.scroll, `${name}: horizontal scroll at ${width}`).toBeLessThanOrEqual(overflow.inner);
  const { violations } = await new AxeBuilder({ page }).analyze();
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} x${v.nodes.length}: ${v.nodes[0]?.html.slice(0, 120)} :: ${v.nodes[0]?.any[0]?.message ?? v.nodes[0]?.failureSummary?.slice(0, 160)}`);
  expect(bad, `${name}: axe at ${width}`).toEqual([]);
  await page.screenshot({ path: path.join(SHOTS, `${name}-${width}.png`), fullPage: true });
};

// Below the sidebar breakpoint the step links live in the "Steps" sheet.
const goToStep = async (page: Page, name: RegExp): Promise<void> => {
  const steps = page.getByRole("button", { name: /^Steps/ });
  if (await steps.isVisible()) {
    await steps.click();
    await page.getByRole("dialog").getByRole("link", { name }).click();
  } else {
    await page.getByRole("link", { name }).first().click();
  }
};

test("login, deposit, publish, logout", async ({ page }) => {
  await page.goto("/depositions");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page).toHaveTitle("Sign in | MDRepo");
  await checkPage(page, "login");

  await signIn(page, "/depositions");

  await page.goto("/depositions");
  await expect(page).toHaveTitle("My depositions | MDRepo");
  await checkPage(page, "depositions");

  await page.getByRole("button", { name: /new/i }).first().click();
  await page.waitForURL(/\/depositions\/[^/]+\/study$/);
  await expect(page).toHaveTitle("Study details - New deposition | MDRepo");

  // Step 1
  await page.getByLabel("Title").fill("E2E lysozyme in water");
  await page.getByLabel("Description").fill("End to end test deposition.");
  await page.getByText("Credits", { exact: true }).click();
  await page.getByText("Publishing", { exact: true }).click();
  await page.getByRole("button", { name: "Add author" }).click();
  await page.getByLabel(/Given name/).fill("Jana");
  await page.getByLabel(/Family name/).fill("Novakova");
  await page.getByRole("dialog").getByRole("button", { name: "Add author" }).click();
  await page.locator("#field-publishing-communityId").click();
  await page.getByRole("option").first().click();
  await expect(page.getByRole("option")).toHaveCount(0);
  await page.getByRole("radio", { name: /^Open Anyone/ }).focus();
  await page.keyboard.press("Space");
  await page.locator("#field-publishing-license").click();
  await page.getByRole("option").first().click();
  // The app bar shows the signed-in name too (first in the DOM), so the author entry is the last match.
  await expect(page.getByText("Jana Novakova").last()).toBeVisible();
  await checkPage(page, "step1-study");

  // Step 2
  await goToStep(page, /Molecular system/);
  await page.waitForURL(/\/system$/);
  await expect(page).toHaveTitle("Molecular system - New deposition | MDRepo");
  await page.locator("input[type=file]").first().setInputFiles({ name: "system.gro", mimeType: "text/plain", buffer: Buffer.from("Lysozyme\n0\n 5.0 5.0 5.0\n") });
  await expect(page.getByText("system.gro").first()).toBeVisible();
  await page.getByText("Search structure").click();
  await page.keyboard.type("lysozyme");
  await page.getByRole("option").first().click();
  await page.getByText("Choose force field").click();
  await page.getByRole("option").first().click();
  await page.locator("#field-engine-engine-name").click();
  await page.getByRole("option").first().click();
  await page.locator("#field-engine-engine-version").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("System size").fill("12000");
  for (const axis of ["X", "Y", "Z"]) await page.getByLabel(`Box vector ${axis}, nm`).fill("5");
  await checkPage(page, "step2-system");

  // Step 3
  await goToStep(page, /Experiments/);
  await page.waitForURL(/\/experiments$/);
  await expect(page).toHaveTitle("Experiments - New deposition | MDRepo");
  await checkPage(page, "step3-experiments");
  await page.getByRole("button", { name: "Add run" }).first().click();
  await page.getByRole("menuitem").first().click();
  await page.waitForURL(/\/experiments\/run-/);
  await page.getByLabel("Name").fill("Minimisation");
  await page.getByLabel("Length").fill("5000");
  await page.locator("input[type=file]").first().setInputFiles({ name: "run.mdp", mimeType: "text/plain", buffer: Buffer.from("integrator = steep\n") });
  await expect(page.getByText("run.mdp").first()).toBeVisible();
  await checkPage(page, "step3-run");

  // Review and publish
  await goToStep(page, /Review/);
  await page.waitForURL(/\/review$/);
  await expect(page).toHaveTitle("Review and publish - New deposition | MDRepo");
  await checkPage(page, "review");
  await page.getByRole("button", { name: "Publish" }).first().click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publish" }).click();
  await page.waitForURL(/\/published$/);
  await expect(page).toHaveTitle("Deposition published | MDRepo");
  await checkPage(page, "published");

  // Logout (through the IdP end-session endpoint, back to /login)
  await signOut(page);
  await page.waitForURL(/\/login/);

  expect(consoleErrors.get(page)).toEqual([]);
});
