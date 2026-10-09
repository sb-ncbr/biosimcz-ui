import { nextCookieJar } from "@/server/session";
import { putContent } from "@/features/upload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUT = async (req: Request, ctx: { params: Promise<{ draftId: string; key: string }> }) => putContent(req, await ctx.params, await nextCookieJar());

export { PUT };
