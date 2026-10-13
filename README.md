# live-view-embedding

Minimal Next.js demo embedding the live view of a Notte browser session in an iframe.

Start a session, watch it live, and switch how the viewer is embedded:

- **Mode**: `embed-minimal` (the page only), `embed` (adds the address bar and steps panel), `full` (adds the session header) or `theatre` (the address bar only).
- **Theme**: light or dark, switched live through the viewer's `set-theme` message.
- **API key**: paste your Notte key ([console.notte.cc](https://console.notte.cc)). It stays in the tab's memory and is only sent to this app's own route, which starts and stops the session.
- **Open viewer**: opens the session's `viewer_url` exactly as the API returns it.

The iframe takes the browser's shape plus the viewer's own controls, so the page fills it without letterboxing.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste your API key, and click **Start browser**.

To skip pasting the key in development, copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_DEV_NOTTE_API_KEY`. It is read only by `next dev`; never set it for a deployed build.

## How it works

`POST /api/session` starts a session (no proxies, default viewport), opens DuckDuckGo in it, and returns its `viewer_url`. The page adds `mode` and `interactive=1` and renders it in an iframe. `DELETE /api/session` stops the session. See the [embedding guide](https://docs.notte.cc/features/sessions/embed-iframe).
