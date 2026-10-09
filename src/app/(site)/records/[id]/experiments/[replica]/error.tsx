"use client";

import { RecordError } from "@/features/record-detail";
import { Content } from "@/shared/ui";

const ReplicaErrorPage = ({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) => (
  <Content className="max-w-6xl max-md:px-4">
    <RecordError digest={error.digest} onRetry={retry} />
  </Content>
);

export default ReplicaErrorPage;
