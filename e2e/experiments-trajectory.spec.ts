import { expect, test, type Page } from "@playwright/test";

const TRAJECTORY = "/records/MD-A007L3/experiments/replica_1/trajectory";
const TRAJECTORY_REQUEST = /\/bff\/records\/[^/]+\/trajectory/;

// Under next dev the first visit of a route compiles it, which outlasts the 5 s expect timeout.
const open = async (page: Page, path = TRAJECTORY): Promise<void> => {
  await page.goto(path);
  await page.waitForURL(/\/trajectory/);
};

const viewer = (page: Page) => page.getByRole("group", { name: /3D structure viewer/ });
const framesInput = (page: Page) => page.getByLabel("Frame window");
const loadButton = (page: Page) => page.getByRole("button", { name: "Load trajectory" });

const trackTrajectoryRequests = (page: Page): string[] => {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (TRAJECTORY_REQUEST.test(new URL(request.url()).pathname)) urls.push(request.url());
  });
  return urls;
};

test("the structure viewer reaches ready on the mock PDB", async ({ page }) => {
  await open(page);
  await expect(viewer(page)).toHaveAttribute("data-status", "ready", { timeout: 60_000 });
  await expect(page.getByText("Structure loaded. Load a frame window to play the trajectory.")).toBeVisible();
});

test("invalid frames show the 1-based error and make no trajectory request", async ({ page }) => {
  const requests = trackTrajectoryRequests(page);
  await open(page);
  await framesInput(page).fill("0:3:1");
  await loadButton(page).click();
  const alert = page.getByRole("alert").filter({ hasText: /1/ });
  await expect(alert.first()).toBeVisible();
  await expect(framesInput(page)).toHaveAttribute("aria-invalid", "true");
  // Give a wrongly fired request time to show up.
  await page.waitForTimeout(500);
  expect(requests).toEqual([]);
});

test("a valid range submits one request and ends in a loaded or error state", async ({ page }) => {
  const requests = trackTrajectoryRequests(page);
  await open(page);
  await framesInput(page).fill("1:3:1");
  await loadButton(page).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(new URL(requests[0] ?? "").searchParams.get("frames")).toBe("1:3:1");
  await expect(page).toHaveURL(/frames=1%3A3%3A1/);
  // The mock body is 4 bytes, not an XTC, so Mol* may reject it; either end state is acceptable, a stuck spinner is not.
  await expect(page.getByRole("status").filter({ hasText: "Loading trajectory" })).toHaveCount(0, { timeout: 60_000 });
  await expect(framesInput(page)).toBeEnabled();
});

test("Enter in the frames input submits the form", async ({ page }) => {
  const requests = trackTrajectoryRequests(page);
  await open(page);
  await framesInput(page).fill("1:3:1");
  await framesInput(page).press("Enter");
  await expect.poll(() => requests.length).toBe(1);
});

test("cancel stops an in-flight download", async ({ page }) => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reached = 0;
  await page.route(TRAJECTORY_REQUEST, async (route) => {
    reached += 1;
    await gate;
    await route.fulfill({ status: 200, contentType: "application/octet-stream", body: Buffer.from([1, 2, 3, 4]) }).catch(() => undefined);
  });
  await open(page);
  await framesInput(page).fill("1:3:1");
  await loadButton(page).click();
  await expect.poll(() => reached).toBe(1);
  await expect(page.getByRole("status").filter({ hasText: "Loading trajectory" })).toBeVisible();
  await expect(framesInput(page)).toBeDisabled();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Download cancelled.")).toBeVisible();
  await expect(loadButton(page)).toBeVisible();
  await expect(framesInput(page)).toBeEnabled();
  release();
  // The late response must not revive the download.
  await page.waitForTimeout(500);
  await expect(page.getByText("Download cancelled.")).toBeVisible();
  await expect(page.getByText("The trajectory could not be downloaded.")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Loading trajectory" })).toHaveCount(0);
});

test("a large request asks for confirmation before downloading", async ({ page }) => {
  // MD-A007L3.1 has 19,686 atoms and 25,031 frames, so even a window of 2000 frames is far above 250 MB.
  const requests = trackTrajectoryRequests(page);
  await open(page);
  await framesInput(page).fill("1:2000:1");
  await loadButton(page).click();
  const dialog = page.getByRole("alertdialog", { name: "Large download" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Change the request" }).click();
  await expect(dialog).toHaveCount(0);
  expect(requests).toEqual([]);

  await loadButton(page).click();
  await page.getByRole("alertdialog", { name: "Large download" }).getByRole("button", { name: "Download anyway" }).click();
  await expect.poll(() => requests.length).toBe(1);
});
