import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mockQueryRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prismaBase: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

import { GET } from "./route";

function makeRequest(url: string): NextRequest {
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

describe("GET /api/health", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 200 ok for default liveness probe without querying the database", async () => {
    const res = await GET(makeRequest("http://localhost:4000/api/health"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("returns 200 ready when ?ready=1 and env + database are healthy", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/clinic";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockQueryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await GET(
      makeRequest("http://localhost:4000/api/health?ready=1")
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: "ready", db: "ok" });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns 503 degraded when ?ready=1 and required env vars are missing", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_ANON_KEY;

    const res = await GET(
      makeRequest("http://localhost:4000/api/health?ready=1")
    );
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({
      status: "degraded",
      db: "unconfigured",
      env: "missing",
    });
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("returns 503 degraded when ?ready=1 and database query fails", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/clinic";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockQueryRaw.mockRejectedValueOnce(new Error("connection refused"));

    const res = await GET(
      makeRequest("http://localhost:4000/api/health?ready=1")
    );
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toMatchObject({ status: "degraded", db: "error" });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });
});
