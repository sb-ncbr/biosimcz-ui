import "server-only";
import { cookies } from "next/headers";
import { sessionCookieOptions } from "../auth/cookie";
import { unstable_update } from "../auth/config";
import type { CookieJar } from "./session";

// writable=false for RSC renders, where Next forbids setting cookies.
const nextCookieJar = async (writable = true): Promise<CookieJar> => {
  const store = await cookies();
  return {
    writable,
    get: (name) => store.get(name)?.value,
    getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
    // Same attributes as when it was set: browsers ignore a __Host- deletion that lacks Secure and Path=/.
    delete: (name) => {
      if (writable) store.set(name, "", { ...sessionCookieOptions(), maxAge: 0 });
    },
    update: async (data) => {
      if (writable) await unstable_update(data as Parameters<typeof unstable_update>[0]);
    },
  };
};

export { nextCookieJar };
