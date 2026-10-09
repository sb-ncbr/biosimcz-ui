import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("the homepage and the search page render without serious a11y violations", async ({ page }) => {
  for (const [path, heading] of [
    ["/", "Repository of computational chemistry experiments"],
    ["/records", "Repository of molecular dynamics simulations"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical"), path).toEqual([]);
  }
});

test("healthz returns 200", async ({ request }) => {
  expect((await request.get("/healthz")).status()).toBe(200);
});
