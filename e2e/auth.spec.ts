import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { idp } from "./support/mockIdp";
import { signIn, signOut } from "./support/signIn";

const DRAFT_PATH = "/depositions/draft-empty/system";
// The app origin under test (APP_ORIGIN in playwright.config.ts); overridable when port 3000 is taken locally.
const ORIGIN = process.env.E2E_ORIGIN ?? "http://localhost:3000";

test.beforeEach(async () => {
  await idp.reset();
});

test.afterEach(async () => {
  await idp.reset();
});

// Long timings do not depend on the viewport, so they run once.
const desktopOnly = (name: string): boolean => name !== "desktop-1280";

const sessionCookies = async (page: Page) => (await page.context().cookies()).filter((cookie) => cookie.name.includes("session-token"));

const logInLink = async (page: Page) => {
  const menuButton = page.getByRole("button", { name: "Open menu" });
  if (await menuButton.isVisible()) {
    await menuButton.click();
    return page.getByRole("dialog").getByRole("link", { name: "Log in" });
  }
  return page.getByRole("link", { name: "Log in" });
};

const seedMirror = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("mdrepo-drafts", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("mirror");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction("mirror", "readwrite");
          tx.objectStore("mirror").put({ marker: "local draft copy" }, "u:101:draft-x");
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
  );

const mirrorCount = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("mdrepo-drafts", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("mirror");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const count = open.result.transaction("mirror", "readonly").objectStore("mirror").count();
          count.onsuccess = () => {
            open.result.close();
            resolve(count.result);
          };
        };
      }),
  );

const dumpBrowserStorage = (page: Page) =>
  page.evaluate(async () => {
    const parts: string[] = [JSON.stringify({ ...localStorage }), JSON.stringify({ ...sessionStorage })];
    for (const { name } of await indexedDB.databases()) {
      if (!name) continue;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      for (const store of Array.from(db.objectStoreNames)) {
        const all = await new Promise<unknown[]>((resolve) => {
          const request = db.transaction(store, "readonly").objectStore(store).getAll();
          request.onsuccess = () => resolve(request.result);
        });
        parts.push(JSON.stringify(all));
      }
      db.close();
    }
    return parts.join("\n");
  });

test("1. anonymous visitors browse the public pages and see Log in", async ({ page }) => {
  // The homepage (/) and the dataset search (/records) are both public; neither redirects.
  for (const path of ["/", "/records"]) {
    await page.goto(path);
    await expect(page).toHaveURL((url) => url.pathname === path && url.search === "");
    await expect(await logInLink(page)).toBeVisible();
  }
});

test("2. a protected page sends anonymous users through login and back to the same page", async ({ page }) => {
  await page.goto(DRAFT_PATH);
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent(DRAFT_PATH)}`);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
  await signIn(page, DRAFT_PATH);
  await expect(page).toHaveURL(DRAFT_PATH);
  expect((await sessionCookies(page)).length).toBeGreaterThan(0);
});

test("3. a foreign next lands on the home page", async ({ page }) => {
  for (const next of ["https://evil.example", "//evil.example", "/\\evil.example"]) {
    await page.context().clearCookies();
    await signIn(page, next);
    await expect(page, next).toHaveURL(`${ORIGIN}/`);
  }
});

test("4. a denied consent comes back to /login with an error and no session", async ({ page }) => {
  await idp.configure({ denyNext: true });
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with e-INFRA CZ" }).click();
  await page.waitForURL(/\/login\?error=/);
  await expect(page.getByRole("alert")).toBeVisible();
  expect(await sessionCookies(page)).toEqual([]);
});

test("5. no token value ever reaches the browser", async ({ page }) => {
  const bodies: string[] = [];
  page.on("response", async (response) => {
    if (!response.url().startsWith(ORIGIN)) return;
    const headers = JSON.stringify(await response.allHeaders());
    const body = await response.text().catch(() => "");
    bodies.push(headers, body);
  });
  await signIn(page, "/depositions");
  await page.goto("/depositions");
  await page.goto("/");
  const session = await page.request.get("/api/auth/session");
  const sessionText = await session.text();
  bodies.push(sessionText);
  expect(JSON.parse(sessionText)).toMatchObject({ user: { id: "101" } });
  expect(Object.keys(JSON.parse(sessionText)).sort()).toEqual(["expires", "user"]);
  bodies.push(await (await page.request.get("/depositions", { headers: { RSC: "1" } })).text());
  expect((await page.request.get("/bff/depositions")).status()).toBe(200);
  await seedMirror(page);

  const { issued } = await idp.state();
  expect(issued.length).toBeGreaterThanOrEqual(3);
  const haystack = [
    ...bodies,
    JSON.stringify(await page.context().cookies()),
    await dumpBrowserStorage(page),
    await page.evaluate(() => document.documentElement.outerHTML),
  ].join("\n");
  for (const token of issued) expect(haystack.includes(token), "an issued token string leaked").toBe(false);
});

test("6. the session survives access-token expiry through silent refresh", async ({ page }, testInfo) => {
  test.skip(desktopOnly(testInfo.project.name), "timing test, runs once");
  test.setTimeout(150_000);
  // The proxy renews 60 s before expiry, so an 80 s token is renewed about every 20 s of activity.
  await idp.configure({ accessTtlS: 80 });
  await signIn(page, "/depositions");
  const started = Date.now();
  // About 70 s of navigation and BFF traffic: the first token expires in between and must be renewed.
  while (Date.now() - started < 70_000) {
    await page.goto("/depositions");
    await expect(page).toHaveURL(/\/depositions$/);
    expect((await page.request.get("/bff/depositions")).status()).toBe(200);
    await page.waitForTimeout(10_000);
  }
  await page.goto("/depositions");
  await expect(page).toHaveURL(/\/depositions$/);
  const { counters } = await idp.state();
  const windows = Math.ceil((Date.now() - started) / 20_000);
  expect(counters.refreshCalls).toBeGreaterThanOrEqual(2);
  // One IdP call per window, however many requests ran in it (parallel renders and BFF calls share the refresh).
  expect(counters.refreshCalls).toBeLessThanOrEqual(windows + 1);
});

test("7. a revoked refresh token sends the next protected navigation back to login", async ({ page }, testInfo) => {
  test.skip(desktopOnly(testInfo.project.name), "same on every viewport");
  await signIn(page, "/depositions");
  await idp.revokeAll();
  await page.goto("/depositions");
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent("/depositions")}`);
  expect(await sessionCookies(page)).toEqual([]);
});

test("8. logout ends the IdP session, wipes the local drafts and locks the protected pages", async ({ page }) => {
  await signIn(page, "/depositions");
  await seedMirror(page);
  expect(await mirrorCount(page)).toBe(1);
  await signOut(page);
  await page.waitForURL(/\/login/);
  const { counters } = await idp.state();
  expect(counters.endSessionCalls).toBe(1);
  expect(counters.endSessionWithHint).toBe(1);
  expect(counters.revokeCalls).toBe(1);
  expect(await mirrorCount(page)).toBe(0);
  expect(await sessionCookies(page)).toEqual([]);
  await page.goto("/depositions");
  await expect(page).toHaveURL(/\/login\?next=%2Fdepositions/);
});

test("9. a cross-origin write to the BFF is refused", async ({ page }) => {
  await signIn(page, "/depositions");
  const { revision } = (await (await page.request.get("/bff/depositions/draft-empty")).json()) as { revision: number };
  const foreign = await page.request.put("/bff/depositions/draft-empty", {
    headers: { origin: "https://evil.example", "content-type": "application/json" },
    data: { draft: {}, revision },
  });
  expect(foreign.status()).toBe(403);
  const own = await page.request.put("/bff/depositions/draft-empty", {
    headers: { origin: ORIGIN, "content-type": "application/json" },
    data: { draft: {}, revision },
  });
  expect(own.status()).toBe(200);
});
