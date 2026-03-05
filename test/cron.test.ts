import { assertEquals, assertNotEquals, assertThrows } from "@std/assert";
import { test } from "@cross/test";
import { Cron, CronIterator } from "../src/cron.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fixed reference Date for deterministic tests. */
function ref(
  year: number,
  month: number, // 1-based
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

// ---------------------------------------------------------------------------
// Cron.next() – basic scheduling
// ---------------------------------------------------------------------------

test("Cron.next: every minute (* * * * *) returns next minute", () => {
  const cron = new Cron("* * * * *");
  const from = ref(2024, 6, 1, 12, 30);
  const next = cron.next(from)!;
  assertEquals(next.getHours(), 12);
  assertEquals(next.getMinutes(), 31);
});

test("Cron.next: specific minute (45 * * * *)", () => {
  const cron = new Cron("45 * * * *");
  const from = ref(2024, 6, 1, 12, 30);
  const next = cron.next(from)!;
  assertEquals(next.getMinutes(), 45);
  assertEquals(next.getHours(), 12);
});

test("Cron.next: specific minute rolls over to next hour when past", () => {
  const cron = new Cron("15 * * * *");
  const from = ref(2024, 6, 1, 12, 30);
  const next = cron.next(from)!;
  assertEquals(next.getHours(), 13);
  assertEquals(next.getMinutes(), 15);
});

test("Cron.next: specific hour and minute (0 9 * * *) from before 09:00", () => {
  const cron = new Cron("0 9 * * *");
  const from = ref(2024, 6, 1, 8, 0);
  const next = cron.next(from)!;
  assertEquals(next.getHours(), 9);
  assertEquals(next.getMinutes(), 0);
  assertEquals(next.getDate(), 1);
});

test("Cron.next: specific hour rolls to next day when past", () => {
  const cron = new Cron("0 9 * * *");
  const from = ref(2024, 6, 1, 10, 0);
  const next = cron.next(from)!;
  assertEquals(next.getDate(), 2);
  assertEquals(next.getHours(), 9);
  assertEquals(next.getMinutes(), 0);
});

test("Cron.next: step syntax (*/15 * * * *) – every 15 minutes", () => {
  const cron = new Cron("*/15 * * * *");
  const from = ref(2024, 6, 1, 12, 0);
  const n1 = cron.next(from)!;
  assertEquals(n1.getMinutes(), 15);
  const n2 = cron.next(n1)!;
  assertEquals(n2.getMinutes(), 30);
  const n3 = cron.next(n2)!;
  assertEquals(n3.getMinutes(), 45);
  const n4 = cron.next(n3)!;
  assertEquals(n4.getMinutes(), 0);
  assertEquals(n4.getHours(), 13);
});

test("Cron.next: specific day-of-month (0 0 15 * *)", () => {
  const cron = new Cron("0 0 15 * *");
  const from = ref(2024, 6, 1);
  const next = cron.next(from)!;
  assertEquals(next.getDate(), 15);
  assertEquals(next.getMonth() + 1, 6);
});

test("Cron.next: specific day-of-month rolls to next month when past", () => {
  const cron = new Cron("0 0 5 * *");
  const from = ref(2024, 6, 10);
  const next = cron.next(from)!;
  assertEquals(next.getMonth() + 1, 7);
  assertEquals(next.getDate(), 5);
});

test("Cron.next: specific month (0 0 1 3 *) – March 1st", () => {
  const cron = new Cron("0 0 1 3 *");
  const from = ref(2024, 1, 1);
  const next = cron.next(from)!;
  assertEquals(next.getMonth() + 1, 3);
  assertEquals(next.getDate(), 1);
  assertEquals(next.getFullYear(), 2024);
});

test("Cron.next: specific month rolls to next year when past", () => {
  const cron = new Cron("0 0 1 1 *");
  const from = ref(2024, 6, 1);
  const next = cron.next(from)!;
  assertEquals(next.getFullYear(), 2025);
  assertEquals(next.getMonth() + 1, 1);
  assertEquals(next.getDate(), 1);
});

test("Cron.next: weekday filter (0 9 * * 1) – Mondays at 09:00", () => {
  const cron = new Cron("0 9 * * 1");
  // 2024-06-01 is Saturday (getDay()===6)
  const from = ref(2024, 6, 1, 9, 0);
  const next = cron.next(from)!;
  assertEquals(next.getDay(), 1); // Monday
  assertEquals(next.getHours(), 9);
});

test("Cron.next: weekday 7 normalised to Sunday (0 12 * * 7)", () => {
  const cron = new Cron("0 12 * * 7");
  const from = ref(2024, 6, 3, 13, 0); // 2024-06-03 is Monday
  const next = cron.next(from)!;
  assertEquals(next.getDay(), 0); // Sunday
});

test("Cron.next: comma list (0 9,17 * * *) – 9am and 5pm", () => {
  const cron = new Cron("0 9,17 * * *");
  const from = ref(2024, 6, 1, 8, 0);
  const n1 = cron.next(from)!;
  assertEquals(n1.getHours(), 9);
  const n2 = cron.next(n1)!;
  assertEquals(n2.getHours(), 17);
  const n3 = cron.next(n2)!;
  assertEquals(n3.getHours(), 9);
  assertEquals(n3.getDate(), 2);
});

test("Cron.next: range (0 0 * * 1-5) – weekdays at midnight", () => {
  const cron = new Cron("0 0 * * 1-5");
  // 2024-06-01 Saturday → next should be Monday 2024-06-03
  const from = ref(2024, 6, 1, 1, 0);
  const next = cron.next(from)!;
  assertEquals(next.getDay(), 1); // Monday
  assertEquals(next.getDate(), 3);
});

test("Cron.next: stopAt option returns null when exceeded", () => {
  const cron = new Cron("* * * * *", { stopAt: ref(2024, 6, 1, 12, 35) });
  const n1 = cron.next(ref(2024, 6, 1, 12, 33))!;
  assertEquals(n1.getMinutes(), 34);
  const n2 = cron.next(n1)!;
  assertEquals(n2.getMinutes(), 35);
  const n3 = cron.next(n2);
  assertEquals(n3, null);
});

test("Cron.next: returns null if no match found (impossible expression)", () => {
  // Feb 30 never exists
  const cron = new Cron("0 0 30 2 *");
  const result = cron.next(ref(2024, 1, 1));
  assertEquals(result, null);
});

// ---------------------------------------------------------------------------
// Cron constructor errors
// ---------------------------------------------------------------------------

test("Cron constructor: throws on wrong field count", () => {
  assertThrows(() => new Cron("* * * *"), Error, "5 fields");
});

test("Cron constructor: throws on out-of-range value", () => {
  assertThrows(() => new Cron("60 * * * *"), Error, "out of allowed range");
});

test("Cron constructor: throws on invalid field text", () => {
  assertThrows(() => new Cron("foo * * * *"), Error);
});

// ---------------------------------------------------------------------------
// Cron.enumerate – factory
// ---------------------------------------------------------------------------

test("Cron.enumerate returns a CronIterator", () => {
  const cron = new Cron("* * * * *");
  const iter = cron.enumerate();
  assertEquals(iter instanceof CronIterator, true);
});

test("Cron.enumerate: independent iterators do not share state", () => {
  const cron = new Cron("* * * * *", { startAt: ref(2024, 6, 1, 12, 0) });
  const iterA = cron.enumerate();
  const iterB = cron.enumerate();

  const a1 = iterA.next().value;
  const a2 = iterA.next().value;

  const b1 = iterB.next().value;

  assertEquals(a1.getTime(), b1.getTime()); // same first value
  assertNotEquals(a2.getTime(), b1.getTime()); // iterA advanced, iterB didn't
});

// ---------------------------------------------------------------------------
// CronIterator – Iterator protocol
// ---------------------------------------------------------------------------

test("CronIterator.next: done:false with a Date value", () => {
  const cron = new Cron("* * * * *");
  const iter = cron.enumerate(ref(2024, 6, 1, 12, 0));
  const result = iter.next();
  assertEquals(result.done, false);
  assertEquals(result.value instanceof Date, true);
});

test("CronIterator.next: successive calls advance cursor", () => {
  const cron = new Cron("*/10 * * * *");
  const iter = cron.enumerate(ref(2024, 6, 1, 12, 0));
  const v1 = iter.next().value;
  const v2 = iter.next().value;
  const v3 = iter.next().value;
  assertEquals(v1.getMinutes(), 10);
  assertEquals(v2.getMinutes(), 20);
  assertEquals(v3.getMinutes(), 30);
});

test("CronIterator.next: done:true when stopAt is reached", () => {
  const cron = new Cron("* * * * *", { stopAt: ref(2024, 6, 1, 12, 32) });
  const iter = cron.enumerate(ref(2024, 6, 1, 12, 30));
  assertEquals(iter.next().value.getMinutes(), 31);
  assertEquals(iter.next().value.getMinutes(), 32);
  const last = iter.next();
  assertEquals(last.done, true);
});

test("CronIterator.next: done:true when maxRuns exhausted", () => {
  const cron = new Cron("* * * * *", { maxRuns: 2 });
  const iter = cron.enumerate(ref(2024, 6, 1, 12, 0));
  assertEquals(iter.next().done, false);
  assertEquals(iter.next().done, false);
  assertEquals(iter.next().done, true);
});

// ---------------------------------------------------------------------------
// CronIterator – Iterable protocol
// ---------------------------------------------------------------------------

test("CronIterator[Symbol.iterator] returns self", () => {
  const cron = new Cron("* * * * *");
  const iter = cron.enumerate(ref(2024, 6, 1, 12, 0));
  assertEquals(iter[Symbol.iterator](), iter);
});

test("for...of with maxRuns bound", () => {
  const cron = new Cron("*/5 * * * *", { maxRuns: 3 });
  const results: Date[] = [];
  for (const date of cron.enumerate(ref(2024, 6, 1, 12, 0))) {
    results.push(date);
  }
  assertEquals(results.length, 3);
  assertEquals(results[0].getMinutes(), 5);
  assertEquals(results[1].getMinutes(), 10);
  assertEquals(results[2].getMinutes(), 15);
});

test("for...of with stopAt bound", () => {
  const cron = new Cron("*/30 * * * *", { stopAt: ref(2024, 6, 1, 13, 0) });
  const results: Date[] = [];
  for (const date of cron.enumerate(ref(2024, 6, 1, 12, 0))) {
    results.push(date);
  }
  // */30 from 12:00 → 12:30, 13:00 (stopAt inclusive), then 13:30 > stopAt → done
  assertEquals(results.length, 2);
  assertEquals(results[0].getMinutes(), 30);
  assertEquals(results[1].getHours(), 13);
  assertEquals(results[1].getMinutes(), 0);
});

test("destructuring: [a, b] captures first two occurrences", () => {
  const cron = new Cron("0 9 * * *", { startAt: ref(2024, 6, 1) });
  const [a, b] = cron.enumerate();
  assertEquals(a instanceof Date, true);
  assertEquals(b instanceof Date, true);
  assertEquals(a.getHours(), 9);
  assertEquals(b.getHours(), 9);
  // b must be exactly one day after a
  const diffMs = b.getTime() - a.getTime();
  assertEquals(diffMs, 24 * 60 * 60 * 1000);
});

// ---------------------------------------------------------------------------
// CronIterator – peek()
// ---------------------------------------------------------------------------

test("CronIterator.peek returns next date without advancing", () => {
  const cron = new Cron("*/10 * * * *");
  const iter = cron.enumerate(ref(2024, 6, 1, 12, 0));
  const peeked = iter.peek()!;
  const nexted = iter.next().value;
  assertEquals(peeked.getTime(), nexted.getTime());
  // Cursor has now advanced – peek should return the *following* value
  const peeked2 = iter.peek()!;
  const nexted2 = iter.next().value;
  assertEquals(peeked2.getTime(), nexted2.getTime());
});

test("CronIterator.peek returns null when maxRuns is exhausted", () => {
  const cron = new Cron("* * * * *", { maxRuns: 1 });
  const iter = cron.enumerate(ref(2024, 6, 1, 12, 0));
  iter.next(); // consume the one allowed run
  assertEquals(iter.peek(), null);
});

// ---------------------------------------------------------------------------
// CronIterator – reset()
// ---------------------------------------------------------------------------

test("CronIterator.reset restarts from beginning", () => {
  const cron = new Cron("*/10 * * * *");
  const iter = cron.enumerate(ref(2024, 6, 1, 12, 0));
  const first = iter.next().value;
  iter.next();
  iter.next();
  iter.reset(ref(2024, 6, 1, 12, 0));
  const afterReset = iter.next().value;
  assertEquals(first.getTime(), afterReset.getTime());
});

test("CronIterator.reset with new start point", () => {
  const cron = new Cron("0 9 * * *");
  const iter = cron.enumerate(ref(2024, 6, 1));
  iter.next(); // 2024-06-01 09:00
  iter.reset(ref(2024, 12, 1)); // jump to December
  const next = iter.next().value;
  assertEquals(next.getMonth() + 1, 12);
  assertEquals(next.getDate(), 1);
  assertEquals(next.getHours(), 9);
});

test("CronIterator.reset also resets maxRuns counter", () => {
  const cron = new Cron("* * * * *", { maxRuns: 2 });
  const iter = cron.enumerate(ref(2024, 6, 1, 12, 0));
  iter.next();
  iter.next();
  assertEquals(iter.next().done, true); // exhausted
  iter.reset(ref(2024, 6, 1, 12, 0));
  assertEquals(iter.next().done, false); // available again after reset
  assertEquals(iter.next().done, false);
  assertEquals(iter.next().done, true);
});
