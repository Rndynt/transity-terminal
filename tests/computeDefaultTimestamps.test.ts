/**
 * §3.7 — `computeDefaultTimestamps` overnight + dwell=0 edge cases.
 *
 * Bug: when a stop has `arriveAt === departAt` (dwell=0) AND that time is
 * close to midnight, the original `<=` check on line 236 triggers a SECOND
 * dayOffset increment when the depart raw timestamp equals the arrive
 * timestamp just set (which sets `lastTimestamp`). The next stop's arrive
 * then evaluates against this "shifted" lastTimestamp and bumps a third
 * time, producing wildly wrong day-2/day-3 timestamps.
 *
 * Test matrix:
 *   1. Plain non-overnight (Stop1 08:00 → Stop2 09:30) — must stay day 0.
 *   2. Simple overnight (Stop1 22:00 → Stop2 23:30 → Stop3 06:00) — Stop3 day 1.
 *   3. Dwell=0 at midnight boundary (the bug) — must NOT double-increment.
 *   4. Multiple midnight crossings (multi-day pattern) — increments correctly.
 *
 * Run: `npx vitest run tests/computeDefaultTimestamps.test.ts`
 */
import { describe, it, expect, beforeAll } from "vitest";

// Disable boot-time JWT validation for tests that don't need it.
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "x".repeat(48);

import type { TripBase } from "@shared/schema";

let TripBasesService: typeof import("@server/modules/tripBases/tripBases.service").TripBasesService;

beforeAll(async () => {
  const mod = await import("@server/modules/tripBases/tripBases.service");
  TripBasesService = mod.TripBasesService;
});

function makeBase(stops: Array<{ stopSequence: number; arriveAt: string | null; departAt: string | null }>): TripBase {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    code: "TEST-BASE",
    patternId: "00000000-0000-0000-0000-000000000002",
    timezone: "UTC",
    sun: true, mon: true, tue: true, wed: true, thu: true, fri: true, sat: true,
    active: true,
    validFrom: null,
    validTo: null,
    capacity: null,
    defaultVehicleId: null,
    defaultDriverId: null,
    defaultStopTimes: stops,
    deletedAt: null,
    createdAt: new Date(),
  } as unknown as TripBase;
}

describe("computeDefaultTimestamps — overnight + dwell=0 (§3.7)", () => {
  it("plain same-day pattern keeps dayOffset=0", () => {
    const svc = new TripBasesService({} as never);
    const base = makeBase([
      { stopSequence: 1, arriveAt: null,    departAt: "08:00" },
      { stopSequence: 2, arriveAt: "09:00", departAt: "09:10" },
      { stopSequence: 3, arriveAt: "10:00", departAt: null },
    ]);
    const out = svc.computeDefaultTimestamps(base, "2030-01-01");

    // All timestamps fall on 2030-01-01.
    for (const r of out) {
      const ts = r.arriveAt ?? r.departAt;
      expect(ts, `stop ${r.stopSequence}`).not.toBeNull();
      expect(ts!.toISOString().slice(0, 10)).toBe("2030-01-01");
    }
  });

  it("simple overnight (22:00 → 23:30 → 06:00) shifts last stop to next day", () => {
    const svc = new TripBasesService({} as never);
    const base = makeBase([
      { stopSequence: 1, arriveAt: null,    departAt: "22:00" },
      { stopSequence: 2, arriveAt: "23:00", departAt: "23:30" },
      { stopSequence: 3, arriveAt: "06:00", departAt: null },
    ]);
    const out = svc.computeDefaultTimestamps(base, "2030-01-01");

    expect(out[0].departAt!.toISOString()).toBe("2030-01-01T22:00:00.000Z");
    expect(out[1].arriveAt!.toISOString()).toBe("2030-01-01T23:00:00.000Z");
    expect(out[1].departAt!.toISOString()).toBe("2030-01-01T23:30:00.000Z");
    expect(out[2].arriveAt!.toISOString()).toBe("2030-01-02T06:00:00.000Z"); // +1 day
  });

  it("dwell=0 at midnight boundary does NOT double-increment dayOffset", () => {
    const svc = new TripBasesService({} as never);
    // Stop 2 has arrive=depart=23:59 (instant transit). Stop 3 is 00:10 next day.
    // Bug repro: with `<=` the depart at 23:59 saw lastTimestamp=23:59 and
    // incremented to day+1, then stop 3's arrive at 00:10 saw lastTimestamp=
    // day+1 23:59 and incremented again → ended up at day+2.
    const base = makeBase([
      { stopSequence: 1, arriveAt: null,    departAt: "08:00" },
      { stopSequence: 2, arriveAt: "23:59", departAt: "23:59" },
      { stopSequence: 3, arriveAt: "00:10", departAt: null    },
    ]);
    const out = svc.computeDefaultTimestamps(base, "2030-01-01");

    expect(out[0].departAt!.toISOString()).toBe("2030-01-01T08:00:00.000Z");
    expect(out[1].arriveAt!.toISOString()).toBe("2030-01-01T23:59:00.000Z");
    expect(out[1].departAt!.toISOString()).toBe("2030-01-01T23:59:00.000Z"); // SAME instant as arrive
    // Stop 3 should be only +1 day, not +2.
    expect(out[2].arriveAt!.toISOString()).toBe("2030-01-02T00:10:00.000Z");
  });

  it("multi-stop overnight with dwell=0 mid-route increments exactly once at the wrap", () => {
    const svc = new TripBasesService({} as never);
    const base = makeBase([
      { stopSequence: 1, arriveAt: null,    departAt: "20:00" },
      { stopSequence: 2, arriveAt: "21:30", departAt: "21:30" }, // dwell=0
      { stopSequence: 3, arriveAt: "23:45", departAt: "23:45" }, // dwell=0
      { stopSequence: 4, arriveAt: "01:15", departAt: null    }, // wrap
    ]);
    const out = svc.computeDefaultTimestamps(base, "2030-01-01");

    expect(out[0].departAt!.toISOString()).toBe("2030-01-01T20:00:00.000Z");
    expect(out[1].arriveAt!.toISOString()).toBe("2030-01-01T21:30:00.000Z");
    expect(out[1].departAt!.toISOString()).toBe("2030-01-01T21:30:00.000Z");
    expect(out[2].arriveAt!.toISOString()).toBe("2030-01-01T23:45:00.000Z");
    expect(out[2].departAt!.toISOString()).toBe("2030-01-01T23:45:00.000Z");
    expect(out[3].arriveAt!.toISOString()).toBe("2030-01-02T01:15:00.000Z"); // exactly +1 day
  });
});
