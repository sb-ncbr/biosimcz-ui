import { expect, test, type Page } from "@playwright/test";

type Box = { x: number; y: number; w: number; h: number };
type Report = { container: Box; grid: Box | null; texts: { text: string; box: Box }[] };

const CANVAS_LABS = ["line", "heatmap-large", "heatmap-categorical", "scatter", "bar"] as const;
const TOLERANCE = 1;

// Axis labels live on the canvas, not in the DOM. The lab page exposes window.__chartLab.measure(id), which reads the
// echarts instance (getInstanceByDom) and returns every text element's box from zrender's display list, in container
// coordinates. This asserts on those boxes directly, so no screenshot comparison is needed.
const measure = (page: Page, id: string) =>
  page.evaluate((labId) => (window as unknown as { __chartLab: { measure: (id: string) => Report | null } }).__chartLab.measure(labId), id);

const inside = (b: Box, c: Box) =>
  b.x >= -TOLERANCE && b.y >= -TOLERANCE && b.x + b.w <= c.w + TOLERANCE && b.y + b.h <= c.h + TOLERANCE;

const isTitle = (text: string) => text.includes("Pairwise contact map") || text === "Interaction classes";

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("chart lab charts render canvases, log no errors and keep labels inside the container", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));

  await page.goto("/dev/charts");
  await expect(page.getByRole("heading", { level: 1, name: "Chart lab" })).toBeVisible();

  for (const id of CANVAS_LABS) {
    const lab = page.locator(`[data-chart-lab="${id}"]`);
    await lab.scrollIntoViewIfNeeded();
    await expect(lab.locator("canvas").first(), id).toBeVisible({ timeout: 30_000 });
  }

  // Empty chart: reason shown, no canvas.
  const empty = page.locator('[data-chart-lab="empty"]');
  await expect(empty.getByText("The trajectory has no hydrogen bonds above the cutoff.")).toBeVisible();
  await expect(empty.locator("canvas")).toHaveCount(0);

  // Stat strip renders its four items.
  await expect(page.locator('[data-chart-lab="stats"] dt')).toHaveCount(4);

  for (const id of CANVAS_LABS) {
    // setOption is lazy; wait until the instance has drawn text.
    await expect.poll(async () => (await measure(page, id))?.texts.length ?? 0, { message: id, timeout: 30_000 }).toBeGreaterThan(0);
    const report = (await measure(page, id))!;
    const container = { x: 0, y: 0, w: report.container.w, h: report.container.h };

    for (const { text, box } of report.texts) {
      expect(inside(box, container), `${id}: "${text}" ${JSON.stringify(box)} outside ${JSON.stringify(container)}`).toBe(true);
    }

    // Left-gutter text is the y axis labels and name; none may overlap each other or the title.
    const grid = report.grid;
    expect(grid, `${id}: grid rect`).not.toBeNull();
    const gutter = report.texts.filter(({ text, box }) => !isTitle(text) && box.x + box.w <= grid!.x + TOLERANCE);
    expect(gutter.length, `${id}: y axis texts`).toBeGreaterThan(0);

    const title = report.texts.find(({ text }) => isTitle(text));
    if (title) {
      for (const label of gutter) expect(overlaps(title.box, label.box), `${id}: title overlaps "${label.text}"`).toBe(false);
      expect(title.box.y + title.box.h, `${id}: title above grid`).toBeLessThanOrEqual(grid!.y + TOLERANCE);
    }
  }

  expect(errors).toEqual([]);
});
