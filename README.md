This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## End-to-end tests

`npm run e2e` starts the mock backend (`npm run mock`, port 9090) and `next dev` on port 3000 with both backends and the
IdP pointed at the mock. When those ports are taken (for example by your own `next dev` against the real API), run on
other ports with a separate build dir so nothing is reused or overwritten:

```bash
E2E_PORT=3200 E2E_MOCK_PORT=9290 E2E_DIST_DIR=.next-e2e npx playwright test
```

PowerShell: `$env:E2E_PORT=3200; $env:E2E_MOCK_PORT=9290; $env:E2E_DIST_DIR='.next-e2e'; npx playwright test`.
With `E2E_PORT` set, Playwright always starts its own servers instead of reusing whatever listens on the port.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
