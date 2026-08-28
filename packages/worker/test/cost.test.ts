import { describe, expect, test } from "vitest";
import {
  analyticsFailureReason,
  analyticsForbiddenReason,
  billedRequestUnits,
  costWindow,
  emptyUsage,
  estimateUsd,
  gbSecondsFromWallTime,
  usageFromGraphql,
} from "../src/cost.js";

describe("durable object cost math", () => {
  test("treats incoming websocket messages at 20:1", () => {
    expect(
      billedRequestUnits({
        ...emptyUsage(),
        invocations: 100,
        incomingWebsocketMessages: 200,
      }),
    ).toBe(110);
  });

  test("converts wall time microseconds to GB-s at 128 MB", () => {
    expect(gbSecondsFromWallTime(1_000_000_000_000)).toBe(128_000);
  });

  test("matches the official 1.5M request billing example", () => {
    const usage = {
      ...emptyUsage(),
      invocations: 1_500_000,
      wallTime: 1_000_000 * 1_000_000,
    };
    const estimate = estimateUsd(usage, true);
    expect(estimate.requests).toBe(0.15);
    expect(estimate.duration).toBe(0);
    expect(estimate.total).toBe(0.15);
  });

  test("does not subtract monthly included allotments for last-24h usage", () => {
    const usage = { ...emptyUsage(), invocations: 100 };
    expect(estimateUsd(usage, false).total).toBeGreaterThan(0);
    expect(estimateUsd(usage, true).total).toBe(0);
  });

  test("sums GraphQL groups and keeps max stored bytes", () => {
    const usage = usageFromGraphql({
      viewer: {
        accounts: [
          {
            durableObjectsInvocationsAdaptiveGroups: [
              { sum: { requests: 10, wallTime: 20 } },
              { sum: { requests: 5, wallTime: 7 } },
            ],
            durableObjectsPeriodicGroups: [
              {
                sum: {
                  cpuTime: 3,
                  incomingWebsocketMsgCount: 40,
                  outboundWebsocketMsgCount: 8,
                },
              },
            ],
            durableObjectsStorageGroups: [
              { max: { storedBytes: 100 } },
              { max: { storedBytes: 250 } },
            ],
          },
        ],
      },
    });
    expect(usage).toEqual({
      invocations: 15,
      wallTime: 27,
      cpuTime: 3,
      incomingWebsocketMessages: 40,
      outboundWebsocketMessages: 8,
      storedBytes: 250,
    });
  });

  test("labels windows as estimates with ISO bounds", () => {
    const since = new Date("2026-08-01T00:00:00.000Z");
    const until = new Date("2026-08-28T00:00:00.000Z");
    const window = costWindow(emptyUsage(), since, until, true);
    expect(window.since).toBe(since.toISOString());
    expect(window.until).toBe(until.toISOString());
    expect(window.estimatedUsd).toBe(0);
  });

  test("maps GraphQL 403 to an unavailable cost reason", () => {
    expect(analyticsFailureReason(403, "Authentication error")).toBe(
      analyticsForbiddenReason,
    );
    expect(analyticsFailureReason(200, "forbidden")).toBe(
      analyticsForbiddenReason,
    );
    expect(analyticsFailureReason(500, "internal")).toMatch(
      /Cloudflare analytics query failed/,
    );
  });
});
