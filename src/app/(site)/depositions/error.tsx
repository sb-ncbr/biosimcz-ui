"use client";

import { Alert, AlertDescription, AlertTitle, Button, Content, H1 } from "@/shared/ui";

// List failures (5xx, network, schema) land here; anonymous users are redirected to login before this boundary.
// The app bar of the (site) layout stays rendered around it (missing-states 4.4).
const DepositionsError = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => (
  <Content className="max-w-none space-y-0 lg:px-8 xl:px-12">
    <H1 className="text-3xl">My depositions</H1>
    <Alert variant="error" role="alert" className="mt-6 max-w-160">
      <AlertTitle>We could not load your depositions.</AlertTitle>
      <AlertDescription>
        <p>Your depositions are safe. Check your connection and try again.</p>
        {error.digest ? <p className="text-text-muted mt-2 text-xs">Details: {error.digest}</p> : null}
      </AlertDescription>
    </Alert>
    <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
      Try again
    </Button>
  </Content>
);

export default DepositionsError;
