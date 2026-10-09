# e-infra design system setup (step 0.1)

- Registry: public npm, no auth. `npm view @e-infra/design-system` latest 0.1.9 (installed 0.1.9).
- Peer deps (all installed explicitly): react 18 or 19, react-dom, tailwindcss ^4, react-hook-form, cmdk, sonner, recharts ^3.6, react-day-picker ^9.13, react-resizable-panels ^4, embla-carousel-react ^8, class-variance-authority, clsx, tailwind-merge, and 24 @radix-ui/react-* packages.
- Runtime deps of the package: lucide-react (icon set), tw-animate-css, next-mdx-remote, gray-matter, rehype-*, remark-gfm.
- Next 16.3.7 + React 19.2.8 + Tailwind 4: `next build --webpack` passes; `transpilePackages` kept as in the MDD reference project.
- CSS: `@import "tailwindcss"; @import "@e-infra/design-system/setup.css"; @source` at the package `dist`.
- Not yet verified: Button variants list, Sidebar/NavItem `asChild` with next/link, Input adornments.
