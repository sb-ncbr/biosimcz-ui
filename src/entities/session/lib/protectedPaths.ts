// Routes that need a session (plan 2.4). Kept pure so proxy.ts and tests share one definition.
const PROTECTED = [/^\/depositions(\/|$)/, /^\/communities\/new\/?$/, /^\/communities\/[^/]+\/edit\/?$/];

const isProtectedPath = (pathname: string): boolean => PROTECTED.some((pattern) => pattern.test(pathname));

export { isProtectedPath };
