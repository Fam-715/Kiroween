import { renderHook } from "@testing-library/react";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "../src/api/client";
import {
  LISTENER_ID_KEY,
  generateUuidV4,
  getOrCreateListenerId,
  isUuidV4,
} from "../src/api/listenerId";
import { useListenerId } from "../src/hooks/useListenerId";

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("useListenerId", () => {
  it("generates a UUID v4 once and persists it", () => {
    const first = renderHook(() => useListenerId());
    expect(isUuidV4(first.result.current)).toBe(true);
    expect(localStorage.getItem(LISTENER_ID_KEY)).toBe(first.result.current);
    first.unmount();
    const second = renderHook(() => useListenerId());
    expect(second.result.current).toBe(first.result.current);
  });

  it("replaces a corrupted stored value", () => {
    localStorage.setItem(LISTENER_ID_KEY, "not-a-uuid");
    expect(isUuidV4(getOrCreateListenerId())).toBe(true);
  });

  it("generated IDs are always valid UUID v4 (property)", () => {
    fc.assert(
      fc.property(fc.constant(null), () => isUuidV4(generateUuidV4())),
      { numRuns: 50 },
    );
  });

  it("repeated lookups return the same ID (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (n) => {
        localStorage.clear();
        const first = getOrCreateListenerId();
        for (let i = 0; i < n; i++) if (getOrCreateListenerId() !== first) return false;
        return true;
      }),
    );
  });
});

describe("apiFetch", () => {
  it("sends X-Listener-Id on every request", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/tapes");
    await apiFetch("/api/tapes", { method: "POST", body: { title: "x" } });
    const id = getOrCreateListenerId();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const call of fetchMock.mock.calls as unknown as [string, RequestInit][]) {
      expect((call[1].headers as Record<string, string>)["X-Listener-Id"]).toBe(id);
    }
  });

  it("throws ApiError with status and parsed 422 violations", async () => {
    const violations = [{ rule: "capacity", side: "A", message: "Side A is full" }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: violations }), { status: 422 })),
    );
    const error = await apiFetch("/api/tapes").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(422);
    expect(apiError.violations).toEqual(violations);
  });

  it("throws ApiError for non-JSON error bodies", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })));
    const error = (await apiFetch("/x").catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(500);
    expect(error.body).toBe("boom");
  });
});
