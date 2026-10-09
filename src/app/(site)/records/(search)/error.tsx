"use client";

import { RecordsError } from "@/features/record-search";
import { RecordSearchHeader } from "@/widgets/record-search-page";
import { Content } from "@/shared/ui";

// Repository failures (5xx, network, schema) land here. The app bar stays rendered and the search form stays usable.
const RecordsPageError = ({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) => (
  <Content className="max-w-none space-y-0 lg:px-8 xl:px-12">
    <RecordSearchHeader />
    <div className="mt-6">
      <RecordsError digest={error.digest} onRetry={retry} />
    </div>
  </Content>
);

export default RecordsPageError;
