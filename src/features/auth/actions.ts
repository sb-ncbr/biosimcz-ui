"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { safeNext } from "@/entities/session";
import { buildEndSessionUrl, getDiscovery, PROVIDER_ID, revokeRefreshToken, signIn, signOut } from "@/server/auth";
import { logger } from "@/server/lib/logger";
import { nextCookieJar, readToken } from "@/server/session";

// Form action of the login page. The target is re-checked here: the hidden field is user input.
const signInWithEinfra = async (formData: FormData): Promise<void> => {
  const next = safeNext(formData.get("next")?.toString());
  try {
    await signIn(PROVIDER_ID, { redirectTo: next });
  } catch (error) {
    // signIn redirects to the IdP by throwing; anything else (discovery down, bad config) lands on a readable page.
    unstable_rethrow(error);
    logger.error("sign-in failed to start", { code: error instanceof Error ? error.name : "unknown" });
    redirect("/login?error=Configuration");
  }
};

// Returns where the browser goes next: the IdP's end-session endpoint when advertised, else /login. Failures upstream
// never keep the local session alive. The client wipes the draft mirrors before calling this.
const logout = async (): Promise<{ redirectTo: string }> => {
  const token = await readToken(await nextCookieJar());
  const discovery = await getDiscovery();
  if (token?.refreshToken && discovery.revocationEndpoint) await revokeRefreshToken(discovery.revocationEndpoint, token.refreshToken);
  await signOut({ redirect: false });
  const endSession = buildEndSessionUrl({ endSessionEndpoint: discovery.endSessionEndpoint, idToken: token?.idToken });
  return { redirectTo: endSession ?? "/login" };
};

export { logout, signInWithEinfra };
