const NAV_LINKS = [
  { href: "/records", label: "Browse" },
  { href: "/communities", label: "Communities" },
  { href: "/depositions", label: "My depositions" },
] as const;

// Where logged-out users land after login; logged-in users create a draft through NewDepositionButton.
const NEW_DEPOSITION_HREF = "/depositions";

const LOGIN_HREF = "/login";

// Logged-out users are sent to login first and land back on the entry point afterwards.
const newDepositionHref = (loggedIn: boolean): string =>
  loggedIn ? NEW_DEPOSITION_HREF : `${LOGIN_HREF}?next=${encodeURIComponent(NEW_DEPOSITION_HREF)}`;

// Browse is the search page only: a record page under /records/ is not "Browse".
const isActive = (pathname: string, href: string): boolean => pathname === href || (href !== "/records" && pathname.startsWith(`${href}/`));

const initialsOf = (label: string): string => {
  const words = label.split(/[\s@.]+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
};

export { isActive, initialsOf, LOGIN_HREF, NAV_LINKS, newDepositionHref };
