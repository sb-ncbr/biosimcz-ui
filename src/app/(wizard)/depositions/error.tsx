"use client";

import Link from "next/link";
import { Alert, AlertDescription, AlertTitle, Button } from "@/shared/ui";

// Draft load failures (5xx, network, schema) land here; auth and not-found are handled before this boundary.
const DepositionError = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => (
  <main className="mx-auto flex w-full max-w-160 flex-col gap-4 px-4 py-16">
    <Alert variant="error" role="alert">
      <AlertTitle>Something went wrong while loading this deposition</AlertTitle>
      <AlertDescription>
        <p>Your saved work is safe. Try again, or go back to your depositions.</p>
        {error.digest ? <p className="text-text-muted mt-2 text-xs">Details: {error.digest}</p> : null}
      </AlertDescription>
    </Alert>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href="/depositions">Go to My depositions</Link>
      </Button>
    </div>
  </main>
);

export default DepositionError;
