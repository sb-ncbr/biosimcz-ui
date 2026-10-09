"use client";

import { RecordError } from "@/features/record-detail";
import { Content } from "@/shared/ui";

// A failing detail fetch (5xx, network, schema) stays inside the site shell; an unknown id is notFound(), not an error.
const RecordErrorPage = ({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) => (
  <Content className="max-w-6xl max-md:px-4">
    <RecordError digest={error.digest} onRetry={retry} />
  </Content>
);

export default RecordErrorPage;
