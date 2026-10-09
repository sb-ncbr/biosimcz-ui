// Next requires segment config to be exported inline, not re-exported at the end.
// Must not call backends: probes should reflect this process only.
export const dynamic = "force-dynamic";

const GET = () => new Response("ok", { status: 200, headers: { "Cache-Control": "no-store" } });

export { GET };
