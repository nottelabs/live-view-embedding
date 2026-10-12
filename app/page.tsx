"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { USER_KEY_HEADER, redactKey } from "../lib/api-key";

// Dev-only convenience: Next inlines NEXT_PUBLIC_ values into the browser bundle, so this
// is read only in development and must never be set for a production build.
const DEV_API_KEY =
  process.env.NODE_ENV === "development" ? (process.env.NEXT_PUBLIC_DEV_NOTTE_API_KEY ?? "") : "";

// The key a session was started with, so Stop uses the same one.
type Session = { sessionId: string; viewerUrl: string; defaultViewerUrl: string; apiKey: string };

// Dev-only: load the viewer from a local console build instead of console.notte.cc.
// Off by default, so a deployed copy always uses the production viewer.
const LOCAL_VIEWER = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_VIEWER === "1";
const LOCAL_CONSOLE = "http://localhost:3333";
// The production API only accepts browser calls from notte.cc origins, so a local
// console reaches it through a local CORS proxy.
const LOCAL_API_PROXY = "ws://localhost:8787";

const ALL_MODES = ["embed-minimal", "embed", "full", "theatre"] as const;
type Mode = (typeof ALL_MODES)[number];
// theatre is not in the production viewer yet, so it is offered only with the local viewer.
const MODES: readonly Mode[] = LOCAL_VIEWER ? ALL_MODES : ALL_MODES.filter((m) => m !== "theatre");

// Default page area of a Notte session: a 1365x768 window minus 87 px of emulated
// browser chrome (stealth_persona.py in notte-api).
const BROWSER_WIDTH = 1365;
const BROWSER_HEIGHT = 681;
// Height the viewer's own controls take above the page, measured per mode.
const VIEWER_CHROME_PX: Record<Mode, number> = { "embed-minimal": 0, theatre: 40, embed: 84, full: 92 };
// Whenever the address bar shows, the production viewer keeps a 30 px gutter around the
// page (15 px per side, in both directions). The local viewer build removes it.
const GUTTER_PX: Record<Mode, number> = LOCAL_VIEWER
  ? { "embed-minimal": 0, theatre: 0, embed: 0, full: 0 }
  : { "embed-minimal": 0, theatre: 30, embed: 30, full: 30 };

function boxHeight(mode: Mode) {
  const g = GUTTER_PX[mode];
  return `calc((100cqw - ${g}px) * ${BROWSER_HEIGHT} / ${BROWSER_WIDTH} + ${g + VIEWER_CHROME_PX[mode]}px)`;
}

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

function viewerSrc(viewerUrl: string, mode: Mode) {
  const url = new URL(viewerUrl);
  url.searchParams.set("mode", mode);
  if (!LOCAL_VIEWER) return url.toString();
  const ws = new URL(url.searchParams.get("ws") ?? "");
  const local = new URL("/static/viewer", LOCAL_CONSOLE);
  url.searchParams.forEach((value, key) => local.searchParams.set(key, value));
  local.searchParams.set("ws", `${LOCAL_API_PROXY}${ws.pathname}`);
  return local.toString();
}

export default function Page() {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("embed-minimal");
  const [theme, setTheme] = useState<Theme>("light");
  // The key lives only in this tab's memory and goes to this app's own API route.
  // In dev it starts pre-filled from .env.local so it does not need pasting each time.
  const [apiKey, setApiKey] = useState(DEV_API_KEY);
  const [keyDraft, setKeyDraft] = useState("");
  const keyHeaders = (key: string): Record<string, string> => (key ? { [USER_KEY_HEADER]: key } : {});
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const src = useMemo(() => (session ? viewerSrc(session.viewerUrl, mode) : null), [session, mode]);

  // The theme travels only by the viewer's set-theme message. A theme in the URL is
  // treated as forced by the viewer and would ignore every later change.
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const sendTheme = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "set-theme", theme: themeRef.current }, "*");
  }, []);
  useEffect(sendTheme, [theme, sendTheme]);
  // The listener inside the viewer mounts after hydration, which can be after the
  // iframe's load event, so resend once the viewer reports it is connected.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source === iframeRef.current?.contentWindow && e.data?.type === "notte-viewer-connected") sendTheme();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sendTheme]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session", { method: "POST", headers: keyHeaders(apiKey) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start");
      setSession({ ...data, apiKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!session) return;
    setBusy(true);
    try {
      await fetch("/api/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...keyHeaders(session.apiKey) },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
    } finally {
      setSession(null);
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={start} disabled={busy || !!session}>Start browser</button>
        <button onClick={stop} disabled={busy || !session}>Stop browser</button>
        <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          {MODES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
          {THEMES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {apiKey ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input value={redactKey(apiKey)} readOnly aria-label="API key in use" style={{ width: 190, fontFamily: "monospace" }} />
            <button onClick={() => setApiKey("")} title="Remove this key and use the default">clear</button>
          </span>
        ) : (
          <input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            onBlur={() => {
              setApiKey(keyDraft.trim());
              setKeyDraft("");
            }}
            placeholder="Paste your Notte API key"
            aria-label="Notte API key"
            autoComplete="off"
            spellCheck={false}
            style={{ width: 290, fontFamily: "monospace" }}
          />
        )}
        {error && <span style={{ color: "crimson" }}>{error}</span>}
        <button
          style={{ marginLeft: "auto" }}
          disabled={!session}
          // The API's own viewer_url, untouched: no mode, theme or interactive params.
          onClick={() => session && window.open(session.defaultViewerUrl, "_blank", "noopener,noreferrer")}
        >
          Open viewer
        </button>
      </div>
      {src && (
        // The box takes the browser's shape plus the viewer's controls, so nothing letterboxes.
        <div style={{ containerType: "inline-size", border: "1px solid #ddd" }}>
          <iframe
            ref={iframeRef}
            src={src}
            onLoad={sendTheme}
            title="Notte browser"
            allow="clipboard-read; clipboard-write"
            style={{
              display: "block",
              width: "100%",
              height: boxHeight(mode),
              border: "none",
            }}
          />
        </div>
      )}
    </main>
  );
}
