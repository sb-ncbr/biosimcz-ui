"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useOptimistic, useTransition, type Context, type ReactNode } from "react";

type NavigateMode = "push" | "replace";

type UrlNavigation<Q> = {
  // Optimistic while a navigation is in flight, so checkboxes, tabs and chips answer the click at once.
  query: Q;
  pending: boolean;
  navigate: (next: Q, mode?: NavigateMode) => void;
};

type UrlNavigationKit<Q> = {
  Provider: (props: { query: Q; children: ReactNode }) => ReactNode;
  useUrlNavigation: () => UrlNavigation<Q>;
};

// The URL is the state: every control builds the next query and navigates; the RSC page re-renders with it.
// `serialize` returns "" or "?a=b", ready to append to the pathname.
const createUrlNavigation = <Q,>(serialize: (query: Q) => string, name = "UrlNavigation"): UrlNavigationKit<Q> => {
  const NavigationContext: Context<UrlNavigation<Q> | null> = createContext<UrlNavigation<Q> | null>(null);

  const Provider = ({ query, children }: { query: Q; children: ReactNode }) => {
    const router = useRouter();
    const pathname = usePathname();
    const [pending, startTransition] = useTransition();
    const [optimistic, setOptimistic] = useOptimistic(query);

    const navigate = useCallback(
      (next: Q, mode: NavigateMode = "push") => {
        startTransition(() => {
          setOptimistic(next);
          const href = `${pathname}${serialize(next)}`;
          if (mode === "replace") router.replace(href, { scroll: false });
          else router.push(href, { scroll: false });
        });
      },
      [pathname, router, setOptimistic],
    );

    const value = useMemo(() => ({ query: optimistic, pending, navigate }), [optimistic, pending, navigate]);
    return <NavigationContext value={value}>{children}</NavigationContext>;
  };

  const useUrlNavigation = (): UrlNavigation<Q> => {
    const value = useContext(NavigationContext);
    if (!value) throw new Error(`use${name} must be used inside ${name}Provider`);
    return value;
  };

  return { Provider, useUrlNavigation };
};

export { createUrlNavigation };
export type { NavigateMode, UrlNavigation, UrlNavigationKit };
