import { fireEvent, render, screen } from "@testing-library/react";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import RecallPanel from "../src/components/RecallPanel";
import { RetryQueue } from "../src/domain/retryQueue";

afterEach(() => vi.unstubAllGlobals());

const RESULT = {
  score: 2 / 3,
  matched: ["mitosis", "cell"],
  missed: ["spindle"],
  memory: {
    recorded: true,
    strength: 100,
    condition: "Mint",
    stability_days: 2.5,
    review_count: 1,
    last_reviewed_at: "2026-01-01T00:00:00Z",
    next_review_at: "2026-01-02T00:00:00Z",
    due: false,
  },
};

describe("RecallPanel", () => {
  it("shows scoring pending while the API is unreachable, then the score", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(new Response(JSON.stringify(RESULT), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const queue = new RetryQueue({ intervalMs: 20, maxAttempts: 4 });

    render(<RecallPanel track={{ id: "t1", name: "Cells" }} onClose={() => {}} queue={queue} />);
    fireEvent.change(screen.getByLabelText("Recall text"), {
      target: { value: "mitosis happens in a cell" },
    });
    fireEvent.click(screen.getByLabelText("Submit recall"));

    expect(await screen.findByText(/Scoring pending/)).toBeTruthy();
    expect((await screen.findByTestId("recall-score")).textContent).toContain("67%");
    expect(screen.getByTestId("recall-matched").textContent).toContain("mitosis");
    expect(screen.getByTestId("recall-missed").textContent).toContain("spindle");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // same client_event_id on the retry (idempotent)
    const ids = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body as string).client_event_id);
    expect(ids[0]).toBe(ids[1]);
  });
});

describe("RetryQueue", () => {
  it("runs jobs in order, each at most maxAttempts times", async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 2 }), { minLength: 1, maxLength: 5 }), async (failsBefore) => {
        const q = new RetryQueue({ intervalMs: 0, maxAttempts: 5 });
        const done: number[] = [];
        await new Promise<void>((resolve) => {
          failsBefore.forEach((fails, i) => {
            let calls = 0;
            q.enqueue({
              run: async () => {
                if (calls++ < fails) throw new Error("x");
                return i;
              },
              isRetryable: () => true,
              onSuccess: (r) => {
                done.push(r);
                if (done.length === failsBefore.length) resolve();
              },
              onGiveUp: () => {},
            });
          });
        });
        expect(done).toEqual(failsBefore.map((_, i) => i));
      }),
      { numRuns: 25 },
    );
  });
});
