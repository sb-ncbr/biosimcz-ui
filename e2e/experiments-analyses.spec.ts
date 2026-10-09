import { expect, test, type Page } from "@playwright/test";

const REPLICA = "/records/MD-A007L3/experiments/replica_1/analyses";
const INSTANCE_ID = "MD-A007L3.1";

// The mock replica lists these 21 names. The five bare bases that also have numbered variants are option lists on the mock
// (the picker never links to them), so only the data names are visited. The synthetic fixtures (rmsd, apl, density,
// lipid-inter, lipid-order, mem-map, thickness, rmsd-pairwise-interface) are not in the replica list, so the page redirects
// them to the analyses index; registry.node.test.ts covers their schemas instead.
const NAMES = [
  "clusters-00",
  "clusters-01",
  "dist-perres-00",
  "energies-00",
  "hbonds-00",
  "interactions",
  "rmsd-pairwise-00",
  "rmsd-pairwise-01",
  "pca",
  "rmsd-perres",
  "pockets",
  "rgyr",
  "rmsds",
  "fluctuation",
  "sasa",
  "tmscores",
] as const;

// Axis labels of production heatmaps cannot be measured here: measureChart (src/shared/viewers/echarts/probe.ts) is only
// exposed as window.__chartLab by the /dev/charts page, which e2e/chart-lab.spec.ts covers. For the production panels the
// check is limited to the canvas lying inside its chart container.
const HEATMAPS = new Set(["hbonds-00", "rmsd-pairwise-00"]);

const PICKER_LABELS = new Set(["Replica", "Analysis type", "Variant"]);

const trackErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
  return errors;
};

const panelSelects = async (page: Page) => {
  const all = page.getByRole("combobox");
  const count = await all.count();
  const result = [];
  for (let i = 0; i < count; i += 1) {
    const label = (await all.nth(i).getAttribute("aria-label")) ?? "";
    if (!PICKER_LABELS.has(label)) result.push(all.nth(i));
  }
  return result;
};

for (const name of NAMES) {
  test(`analysis ${name} shows a chart or the empty state`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`${REPLICA}/${name}`);
    await page.waitForURL(new RegExp(`/analyses/${name}$`));

    const canvas = page.locator("main canvas").first();
    const empty = page.locator('main [role="status"].border-dashed');
    await expect(canvas.or(empty).first()).toBeVisible({ timeout: 60_000 });

    await expect(page.getByRole("link", { name: "Download JSON" })).toHaveAttribute("href", `/bff/records/${INSTANCE_ID}/analyses/${name}`);
    await expect(page.getByText("Data shape not recognised")).toHaveCount(0);
    await expect(page.getByText("Could not load this analysis")).toHaveCount(0);

    if (HEATMAPS.has(name)) {
      await expect(canvas).toBeVisible();
      const container = await page.locator('main [role="img"]').first().boundingBox();
      const box = await canvas.boundingBox();
      expect(container, `${name}: container box`).not.toBeNull();
      expect(box, `${name}: canvas box`).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(container!.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(container!.x + container!.width + 1);
    }

    const selects = await panelSelects(page);
    for (let i = 0; i < selects.length; i += 1) {
      const trigger = selects[i]!;
      if (await trigger.isDisabled()) continue;
      await trigger.click();
      const options = page.getByRole("option");
      const count = await options.count();
      if (count > 1) {
        // The last option is never the initial one for these fixtures' default selection.
        await options.nth(count - 1).click();
      } else {
        await page.keyboard.press("Escape");
      }
      await page.waitForTimeout(300);
      expect((await panelSelects(page)).length, `${name}: selects stay mounted`).toBe(selects.length);
      await expect((await panelSelects(page))[i]!).toBeVisible();
    }

    expect(errors).toEqual([]);
  });
}
