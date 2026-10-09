import { nextCookieJar } from "@/server/session";
import { deleteFile } from "@/features/upload/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DELETE = async (req: Request, ctx: { params: Promise<{ draftId: string; key: string }> }) => deleteFile(req, await ctx.params, await nextCookieJar());

export { DELETE };
