// Stand-in for next-intl (phase 7). Auth.js error codes arrive in ?error=; only allow-listed ones get specific copy.
const LOGIN_ERRORS: Record<string, string> = {
  Configuration: "Sign-in is not set up correctly right now. Try again later or contact the administrators.",
  AccessDenied: "Sign-in was cancelled or your account is not allowed to use MDRepo.",
  Verification: "The sign-in attempt is no longer valid. Start again.",
};

const GENERIC_LOGIN_ERROR = "Sign-in did not work. Try again.";

const SESSION_EXPIRED_MESSAGE = "Your session has expired. Sign in again to continue.";

const loginErrorMessage = (code: string): string => (Object.hasOwn(LOGIN_ERRORS, code) ? LOGIN_ERRORS[code]! : GENERIC_LOGIN_ERROR);

export { loginErrorMessage, SESSION_EXPIRED_MESSAGE };
