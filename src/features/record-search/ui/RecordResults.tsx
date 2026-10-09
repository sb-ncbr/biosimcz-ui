import {
  RECORD_PAGE_SIZE,
  RecordCard,
  type RecordSearchResult,
} from "@/entities/record";
import { RecordPagination, RecordResultsRegion } from "./RecordResultsClient";

// Server component: the cards render on the server, only the busy region and the pagination links are client islands.
const RecordResults = ({ result }: { result: RecordSearchResult }) => (
  <RecordResultsRegion total={result.total}>
    <ul className="flex flex-col gap-4">
      {result.items.map((record) => (
        <li key={record.id}>
          <RecordCard record={record} />
        </li>
      ))}
    </ul>
    <RecordPagination
      total={result.total}
      size={result.size || RECORD_PAGE_SIZE}
    />
  </RecordResultsRegion>
);

export { RecordResults };
