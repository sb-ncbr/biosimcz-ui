import { safeNext } from "./safeNext";

const LOGIN_PATH = "/login";

// Set when the backend rejected a session our cookie still holds. RSC cannot clear cookies, so the proxy clears it
// on /login and drops the flag; without that the login page would see the session and bounce straight back.
const EXPIRED_PARAM = "expired";

const loginHref = (next: string, { expired = false }: { expired?: boolean } = {}): string => {
  const params = new URLSearchParams({ next: safeNext(next) });
  if (expired) params.set(EXPIRED_PARAM, "1");
  return `${LOGIN_PATH}?${params.toString()}`;
};

export { EXPIRED_PARAM, LOGIN_PATH, loginHref };
