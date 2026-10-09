// The barrel of my-depositions carries a server action and UI; this handler only needs the pure URL parser.
// eslint-disable-next-line no-restricted-imports
import { parseListQuery } from "@/features/my-depositions/model/urlState";
import { isApiError, problemResponse } from "@/server/http/errors";
import { logger } from "@/server/lib/logger";
import { listMine } from "@/server/repositories/deposition";
import { assertSameOrigin, nextCookieJar } from "@/server/session";

const noStore = { "Cache-Control": "no-store" };

// Result count for the filter choices inside the mobile sheet ("Show N results"). Same query parameters as the page;
// one item is requested because only the total is used. Reads the user's own list only (session required).
const GET = async (request: Request): Promise<Response> => {
  try {
    assertSameOrigin(request);
    const query = parseListQuery(new URL(request.url).searchParams);
    const { total } = await listMine(await nextCookieJar(), query, 1);
    return Response.json({ total }, { headers: noStore });
  } catch (error) {
    if (!isApiError(error)) logger.error("depositions count route failed unexpectedly", { name: error instanceof Error ? error.name : typeof error });
    return problemResponse(error);
  }
};

export { GET };
