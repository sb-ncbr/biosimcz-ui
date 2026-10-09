import "server-only";
import { redirect } from "next/navigation";
import { safeNext } from "@/entities/session";
import { nextCookieJar } from "./nextJar";
import type { Session } from "./session";
import { readToken, toSessionUser } from "./token";

const getCurrentSession = async (): Promise<Session | null> => {
  const token = await readToken(await nextCookieJar(false));
  return token ? { user: toSessionUser(token) } : null;
};

// For RSC pages and layouts: sends anonymous users to the login page. The proxy check alone is bypassable.
const requireSessionOrRedirect = async (next: string): Promise<Session> => {
  const session = await getCurrentSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
  return session;
};

export { getCurrentSession, requireSessionOrRedirect };
