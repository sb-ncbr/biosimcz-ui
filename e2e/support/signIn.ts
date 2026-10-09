import { expect, type Page } from "@playwright/test";

// Signs in through the real OIDC flow against the mock IdP (npm run mock): /login, "Sign in with e-INFRA CZ",
// the mock's Continue button, back to the app. Other specs call this instead of knowing about the IdP.
// Without `next` the app lands on "/".
const signIn = async (page: Page, next?: string): Promise<void> => {
  await page.goto(next === undefined ? "/login" : `/login?next=${encodeURIComponent(next)}`);
  await page.getByRole("button", { name: "Sign in with e-INFRA CZ" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL((url) => url.origin === new URL(page.url()).origin && !url.pathname.startsWith("/login") && !url.pathname.startsWith("/api/auth"));
  await expect(page.locator("body")).toBeVisible();
};

// Phones keep the account area in the menu sheet; desktop has the account dropdown.
const signOut = async (page: Page): Promise<void> => {
  const menuButton = page.getByRole("button", { name: "Open menu" });
  if (await menuButton.isVisible()) {
    await menuButton.click();
    await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
  } else {
    await page.getByRole("button", { name: /^Account/ }).click();
    await page.getByRole("menuitem", { name: /sign out|log out/i }).click();
  }
};

export { signIn, signOut };
