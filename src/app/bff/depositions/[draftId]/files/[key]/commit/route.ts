import { nextCookieJar } from "@/server/session";
import { commitFile } from "@/features/upload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POST = async (req: Request, ctx: { params: Promise<{ draftId: string; key: string }> }) => commitFile(req, await ctx.params, await nextCookieJar());

export { POST };
