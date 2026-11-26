import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { callbacks, removeChannel } = vi.hoisted(() => ({
  callbacks: new Map<string, () => void>(),
  removeChannel: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseClient: () => ({
    channel: (name: string) => {
      const ch = {
        name,
        on: (_type: string, opts: { table: string }, cb: () => void) => {
          callbacks.set(opts.table, cb);
          return ch;
        },
        subscribe: () => ch,
      };
      return ch;
    },
    removeChannel,
  }),
}));

import { createRealtimeStreams } from "../realtime-stream";

describe("createRealtimeStreams debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    callbacks.clear();
    removeChannel.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces bursts of row events into a single RESYNC emission", () => {
    const realtime = createRealtimeStreams("clinic-1", 500);
    const patients$ = realtime.streams.get("patients")!;
    const received: string[] = [];
    const sub = patients$.subscribe((item) => received.push(String(item)));

    const firePatientChange = callbacks.get("patients");
    expect(firePatientChange).toBeTypeOf("function");

    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(10);
      firePatientChange?.();
    }

    expect(received).toHaveLength(0);

    vi.advanceTimersByTime(499);
    expect(received).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(received).toEqual(["RESYNC"]);

    sub.unsubscribe();
    realtime.cleanup();
  });

  it("cancels pending debounce timers on cleanup", () => {
    const realtime = createRealtimeStreams("clinic-1", 500);
    const patients$ = realtime.streams.get("patients")!;
    const received: string[] = [];
    patients$.subscribe((item) => received.push(String(item)));

    callbacks.get("patients")?.();
    vi.advanceTimersByTime(200);
    realtime.cleanup();
    vi.advanceTimersByTime(500);

    expect(received).toEqual([]);
    expect(removeChannel).toHaveBeenCalled();
  });
});
