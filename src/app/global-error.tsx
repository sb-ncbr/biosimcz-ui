"use client";

// Replaces the root layout on failure, so it must render its own html/body
// and cannot rely on providers or the design-system stylesheet being present.
const GlobalError = ({ reset }: { error: Error & { digest?: string }; reset: () => void }) => (
  <html lang="en">
    <body>
      <h1>Something went wrong</h1>
      <button type="button" onClick={reset}>
        Try again
      </button>
    </body>
  </html>
);

export default GlobalError;
