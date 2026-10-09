"use client";

import { Alert, AlertDescription, AlertTitle, Button } from "@/shared/ui";
import { RecordBreadcrumb } from "./RecordHeader";

// Upstream failure (MDposit down, timeout, unexpected shape): the record may exist, so it is not a 404.
const RecordError = ({ digest, onRetry }: { digest?: string | undefined; onRetry: () => void }) => (
  <div className="flex flex-col gap-6">
    <RecordBreadcrumb current="Record" />
    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">This record could not be loaded</h1>
    <Alert variant="error" role="alert" className="max-w-160">
      <AlertTitle>The data source did not respond as expected.</AlertTitle>
      <AlertDescription>
        Try again in a moment.{digest ? <span className="text-text-muted mt-1 block text-xs">Error code: {digest}</span> : null}
      </AlertDescription>
    </Alert>
    <div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry} className="max-md:min-h-11">
        Try again
      </Button>
    </div>
  </div>
);

export { RecordError };
