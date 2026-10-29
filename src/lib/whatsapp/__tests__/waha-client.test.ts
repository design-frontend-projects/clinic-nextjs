import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toChatId, sendText, getSessionStatus } from "@/lib/whatsapp/waha-client";
import { WahaError } from "@/lib/errors";

describe("waha-client", () => {
  describe("toChatId", () => {
    it("normalizes a formatted number to <digits>@c.us", () => {
      expect(toChatId("+20 100 123 4567")).toBe("201001234567@c.us");
      expect(toChatId("(201) 555-0199")).toBe("2015550199@c.us");
    });
    it("throws invalid_number for too-short / empty / null values", () => {
      for (const bad of ["123", "", null, undefined]) {
        expect(() => toChatId(bad)).toThrowError(WahaError);
        try {
          toChatId(bad);
        } catch (e) {
          expect((e as WahaError).code).toBe("invalid_number");
        }
      }
    });
    it("throws invalid_number for too-long values", () => {
      expect(() => toChatId("1234567890123456")).toThrowError(WahaError);
    });
  });

  describe("gateway calls", () => {
    beforeEach(() => {
      process.env.WAHA_BASE_URL = "http://waha:3000";
      process.env.WAHA_API_KEY = "test-key";
      process.env.WAHA_SESSION = "default";
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("sendText posts to /api/sendText with the api key header", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "true_123@c.us" }), { status: 201 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const res = await sendText({ chatId: "201001234567@c.us", text: "hi" });
      expect(res.id).toBe("true_123@c.us");

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("http://waha:3000/api/sendText");
      expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("test-key");
      expect(JSON.parse(init.body as string)).toMatchObject({
        session: "default",
        chatId: "201001234567@c.us",
        text: "hi",
      });
    });

    it("maps 401 to a WahaError(auth)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
      await expect(sendText({ chatId: "x@c.us", text: "hi" })).rejects.toMatchObject({
        code: "auth",
      });
    });

    it("maps a network failure to WahaError(unreachable)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
      await expect(getSessionStatus()).rejects.toMatchObject({ code: "unreachable" });
    });

    it("throws WahaError(config) when env is missing", async () => {
      delete process.env.WAHA_BASE_URL;
      await expect(sendText({ chatId: "x@c.us", text: "hi" })).rejects.toMatchObject({
        code: "config",
      });
    });
  });
});
