import { NextResponse, after } from "next/server";
import { USER_KEY_HEADER } from "../../../lib/api-key";

const API = "https://api.notte.cc";
const START_PAGE = "https://duckduckgo.com";

/** The server holds no key: every call uses the one the page sends. */
function headers(req: Request) {
  const key = req.headers.get(USER_KEY_HEADER)?.trim();
  if (!key) throw new Error("No API key: paste one in the field");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/** Start a session and hand back its viewer URL. */
export async function POST(req: Request) {
  try {
    const auth = headers(req);
    const res = await fetch(`${API}/sessions/start`, {
      method: "POST",
      headers: auth,
      // proxies default to true and add ~1s; a custom viewport forces a resize of the prewarmed browser (~250ms).
      body: JSON.stringify({ max_duration_minutes: 15, proxies: false, solve_captchas: false }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const s = (await res.json()) as { session_id: string; viewer_url: string | null };
    if (!s.viewer_url) throw new Error("session started without a viewer url");
    // Load a page in the background so the viewer is not stuck on "waiting for navigation".
    after(() =>
      fetch(`${API}/sessions/${s.session_id}/page/execute`, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ type: "goto", url: START_PAGE }),
      }).catch(() => {}),
    );
    const url = new URL(s.viewer_url);
    url.searchParams.set("interactive", "1");
    // defaultViewerUrl is viewer_url exactly as the API returned it, for "Open viewer".
    return NextResponse.json({ sessionId: s.session_id, viewerUrl: url.toString(), defaultViewerUrl: s.viewer_url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { sessionId } = (await req.json()) as { sessionId?: string };
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  try {
    const res = await fetch(`${API}/sessions/${sessionId}/stop`, { method: "DELETE", headers: headers(req), cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
