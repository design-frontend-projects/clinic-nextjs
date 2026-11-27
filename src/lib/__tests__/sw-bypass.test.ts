import { describe, it, expect } from "vitest";
import {
  isNextRscRequest,
  shouldBypassServiceWorker,
} from "@/lib/sw-bypass";

const ORIGIN = "https://rkkbqnzxzkhmn4gof16rwwbn.79.72.6.5.sslip.io";

describe("shouldBypassServiceWorker", () => {
  it("bypasses non-GET requests such as Next.js Server Action POSTs", () => {
    const req = new Request(`${ORIGIN}/ar/admin/staff`, { method: "POST" });
    expect(shouldBypassServiceWorker(req, ORIGIN)).toBe(true);

    const putReq = new Request(`${ORIGIN}/ar/admin/staff`, { method: "PUT" });
    expect(shouldBypassServiceWorker(putReq, ORIGIN)).toBe(true);

    const delReq = new Request(`${ORIGIN}/ar/admin/staff`, { method: "DELETE" });
    expect(shouldBypassServiceWorker(delReq, ORIGIN)).toBe(true);
  });

  it("bypasses Next.js RSC and router prefetch requests", () => {
    const rscHeaderReq = new Request(`${ORIGIN}/ar/admin/staff`, {
      headers: { RSC: "1" },
    });
    expect(shouldBypassServiceWorker(rscHeaderReq, ORIGIN)).toBe(true);

    const prefetchReq = new Request(`${ORIGIN}/ar/admin/staff`, {
      headers: { "Next-Router-Prefetch": "1" },
    });
    expect(shouldBypassServiceWorker(prefetchReq, ORIGIN)).toBe(true);

    const stateTreeReq = new Request(`${ORIGIN}/ar/admin/staff`, {
      headers: { "Next-Router-State-Tree": "%5B%22%22%5D" },
    });
    expect(shouldBypassServiceWorker(stateTreeReq, ORIGIN)).toBe(true);

    const segmentPrefetchReq = new Request(`${ORIGIN}/ar/admin/staff`, {
      headers: { "Next-Router-Segment-Prefetch": "/_tree" },
    });
    expect(shouldBypassServiceWorker(segmentPrefetchReq, ORIGIN)).toBe(true);

    const rscQueryUrl = new URL(`${ORIGIN}/ar/admin/staff?_rsc=abc123`);
    const rscQueryReq = new Request(rscQueryUrl.toString());
    expect(isNextRscRequest(rscQueryReq, rscQueryUrl)).toBe(true);
    expect(shouldBypassServiceWorker(rscQueryReq, ORIGIN)).toBe(true);
  });

  it("bypasses auth routes and OAuth callbacks", () => {
    expect(
      shouldBypassServiceWorker(new Request(`${ORIGIN}/ar/sign-in`), ORIGIN),
    ).toBe(true);
    expect(
      shouldBypassServiceWorker(new Request(`${ORIGIN}/en/onboarding`), ORIGIN),
    ).toBe(true);
    expect(
      shouldBypassServiceWorker(
        new Request(`${ORIGIN}/auth/callback?code=123`),
        ORIGIN,
      ),
    ).toBe(true);
  });

  it("bypasses Supabase requests and same-origin /api/ routes", () => {
    expect(
      shouldBypassServiceWorker(
        new Request(
          "https://vjlwptkbxmcqrgrrgimn.supabase.co/auth/v1/token?grant_type=password",
        ),
        ORIGIN,
      ),
    ).toBe(true);

    expect(
      shouldBypassServiceWorker(
        new Request(`${ORIGIN}/api/sync/pull?clinicId=123`),
        ORIGIN,
      ),
    ).toBe(true);

    expect(
      shouldBypassServiceWorker(
        new Request(`${ORIGIN}/api/health`),
        ORIGIN,
      ),
    ).toBe(true);
  });

  it("allows standard document navigations and static assets to be handled by the SW", () => {
    const navReq = new Request(`${ORIGIN}/ar/admin/staff`, { method: "GET" });
    expect(shouldBypassServiceWorker(navReq, ORIGIN)).toBe(false);

    const chunkReq = new Request(
      `${ORIGIN}/_next/static/chunks/main-app.js`,
      { method: "GET" },
    );
    expect(shouldBypassServiceWorker(chunkReq, ORIGIN)).toBe(false);

    const iconReq = new Request(`${ORIGIN}/icons/icon-192.png`, {
      method: "GET",
    });
    expect(shouldBypassServiceWorker(iconReq, ORIGIN)).toBe(false);
  });
});
