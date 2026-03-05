/**
 * Cron expression parser and scheduler utilities.
 *
 * Provides a stateless {@link Cron} class for computing scheduled dates from a cron expression,
 * and a stateful {@link CronIterator} for sequential date traversal using the ECMAScript iterator
 * protocol.
 *
 * @example
 * ```ts
 * import { Cron } from "@cross/image";
 *
 * const job = new Cron("0 9 * * 1-5"); // 09:00 on weekdays
 * const [a, b, c] = job.enumerate();
 * console.log(a, b, c); // next three 09:00 weekday occurrences
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for the {@link Cron} constructor. */
export interface CronOptions {
  /**
   * The start point for `enumerate()` when no explicit `startAt` is passed.
   * Defaults to `Date.now()` at call time.
   */
  startAt?: Date;
  /**
   * Inclusive upper bound: occurrences after this date will be treated as done.
   */
  stopAt?: Date;
  /**
   * Maximum number of occurrences the iterator will yield.
   * Useful for finite sequences such as `@yearly` jobs you want to cap.
   */
  maxRuns?: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ParsedField {
  values: number[];
  isWildcard: boolean;
}

/** Parse a single cron field into an ascending list of integers. */
function parseField(field: string, min: number, max: number): ParsedField {
  if (field === "*") {
    const values: number[] = [];
    for (let i = min; i <= max; i++) values.push(i);
    return { values, isWildcard: true };
  }

  const values = new Set<number>();

  for (const part of field.split(",")) {
    if (part.includes("/")) {
      // step: range/step  or  */step
      const slashIdx = part.lastIndexOf("/");
      const rangePart = part.slice(0, slashIdx);
      const stepNum = parseInt(part.slice(slashIdx + 1), 10);
      if (isNaN(stepNum) || stepNum <= 0) {
        throw new Error(`Invalid cron step value: "${part.slice(slashIdx + 1)}"`);
      }

      let start = min;
      let end = max;

      if (rangePart !== "*") {
        if (rangePart.includes("-")) {
          const dash = rangePart.indexOf("-");
          start = parseInt(rangePart.slice(0, dash), 10);
          end = parseInt(rangePart.slice(dash + 1), 10);
        } else {
          start = parseInt(rangePart, 10);
          end = max;
        }
      }

      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid cron range: "${rangePart}"`);
      }

      for (let i = start; i <= end; i += stepNum) {
        values.add(i);
      }
    } else if (part.includes("-")) {
      const dash = part.indexOf("-");
      const start = parseInt(part.slice(0, dash), 10);
      const end = parseInt(part.slice(dash + 1), 10);
      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid cron range: "${part}"`);
      }
      for (let i = start; i <= end; i++) {
        values.add(i);
      }
    } else {
      const num = parseInt(part, 10);
      if (isNaN(num)) {
        throw new Error(`Invalid cron field value: "${part}"`);
      }
      values.add(num);
    }
  }

  // Range validation
  for (const v of values) {
    if (v < min || v > max) {
      throw new Error(`Cron value ${v} is out of allowed range [${min}, ${max}]`);
    }
  }

  return { values: [...values].sort((a, b) => a - b), isWildcard: false };
}

/** Return the first value in `sorted` that is >= `current`, or `null` if none. */
function nextGte(sorted: number[], current: number): number | null {
  for (const v of sorted) {
    if (v >= current) return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cron
// ---------------------------------------------------------------------------

/**
 * Stateless cron schedule based on a standard 5-field expression.
 *
 * Field order: `minute hour day-of-month month day-of-week`
 *
 * Supported syntax per field:
 * - `*` – every value
 * - `n` – exact value
 * - `n-m` – inclusive range
 * - `n,m,...` – list
 * - `n/step` or `n-m/step` – step; use `* /step` (written without a space) for full-range steps
 *
 * @example
 * ```ts
 * const weekdays9am = new Cron("0 9 * * 1-5");
 * const everyHour = new Cron("0 * * * *");
 * ```
 */
export class Cron {
  private readonly minutes: ParsedField;
  private readonly hours: ParsedField;
  private readonly days: ParsedField;
  private readonly months: ParsedField;
  private readonly weekdays: ParsedField;

  /** The options passed to the constructor (read-only). */
  readonly options: Readonly<CronOptions>;

  /**
   * Create a new Cron instance.
   *
   * @param expression A 5-field cron expression (`min hour dom month dow`).
   * @param options    Optional scheduling boundaries and limits.
   */
  constructor(expression: string, options: CronOptions = {}) {
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5) {
      throw new Error(
        `Cron expression must have exactly 5 fields (got ${fields.length}): "${expression}"`,
      );
    }

    this.minutes = parseField(fields[0], 0, 59);
    this.hours = parseField(fields[1], 0, 23);
    this.days = parseField(fields[2], 1, 31);
    this.months = parseField(fields[3], 1, 12);

    // weekday: accept 0-7 where both 0 and 7 mean Sunday
    const rawWeekday = parseField(fields[4], 0, 7);
    const normalizedValues = [...new Set(rawWeekday.values.map((v) => (v === 7 ? 0 : v)))].sort(
      (a, b) => a - b,
    );
    this.weekdays = { values: normalizedValues, isWildcard: rawWeekday.isWildcard };

    this.options = Object.freeze({ ...options });
  }

  /**
   * Return the next scheduled `Date` strictly after `from`.
   *
   * Returns `null` when no future occurrence can be found within a 4-year
   * search window, or when the result would exceed `options.stopAt`.
   *
   * @param from The reference point. Defaults to `new Date()`.
   */
  next(from?: Date): Date | null {
    // Start one minute after `from` (cron resolution is 1 minute).
    const d = from ? new Date(from.getTime()) : new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);

    const limitMs = d.getTime() + 4 * 366 * 24 * 60 * 60 * 1000; // ~4 years

    while (d.getTime() <= limitMs) {
      // ── Month ────────────────────────────────────────────────────────────
      const monthVal = d.getMonth() + 1; // 1-12
      if (!this.months.isWildcard && !this.months.values.includes(monthVal)) {
        const nxt = nextGte(this.months.values, monthVal);
        if (nxt === null) {
          // Roll to first valid month of next year
          d.setFullYear(d.getFullYear() + 1, this.months.values[0] - 1, 1);
          d.setHours(0, 0, 0, 0);
        } else {
          d.setMonth(nxt - 1, 1);
          d.setHours(0, 0, 0, 0);
        }
        continue;
      }

      // ── Day-of-month / day-of-week ────────────────────────────────────
      const domVal = d.getDate(); // 1-31
      const dowVal = d.getDay(); // 0-6

      const domMatch = this.days.isWildcard || this.days.values.includes(domVal);
      const dowMatch = this.weekdays.isWildcard || this.weekdays.values.includes(dowVal);

      let dayMatches: boolean;
      if (this.days.isWildcard && this.weekdays.isWildcard) {
        dayMatches = true;
      } else if (this.days.isWildcard) {
        dayMatches = dowMatch;
      } else if (this.weekdays.isWildcard) {
        dayMatches = domMatch;
      } else {
        // Both fields explicitly specified → union (standard cron behaviour)
        dayMatches = domMatch || dowMatch;
      }

      if (!dayMatches) {
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);
        continue;
      }

      // ── Hour ─────────────────────────────────────────────────────────────
      const hourVal = d.getHours();
      if (!this.hours.isWildcard && !this.hours.values.includes(hourVal)) {
        const nxt = nextGte(this.hours.values, hourVal);
        if (nxt === null) {
          d.setDate(d.getDate() + 1);
          d.setHours(0, 0, 0, 0);
        } else {
          d.setHours(nxt, 0, 0, 0);
        }
        continue;
      }

      // ── Minute ───────────────────────────────────────────────────────────
      const minVal = d.getMinutes();
      if (!this.minutes.isWildcard && !this.minutes.values.includes(minVal)) {
        const nxt = nextGte(this.minutes.values, minVal);
        if (nxt === null) {
          d.setHours(d.getHours() + 1, 0, 0, 0);
        } else {
          d.setMinutes(nxt, 0, 0);
        }
        continue;
      }

      // ── All fields match ─────────────────────────────────────────────────
      // Check stopAt boundary
      if (this.options.stopAt && d > this.options.stopAt) {
        return null;
      }
      return new Date(d);
    }

    return null;
  }

  /**
   * Create a stateful {@link CronIterator} that yields scheduled dates one at
   * a time, starting from `startAt` (or `options.startAt`, or `Date.now()`).
   *
   * The Cron instance itself remains stateless; calling `enumerate()` multiple
   * times produces independent iterators.
   *
   * @param startAt Optional starting point for the iterator cursor.
   */
  enumerate(startAt?: Date): CronIterator {
    return new CronIterator(this, startAt);
  }
}

// ---------------------------------------------------------------------------
// CronIterator
// ---------------------------------------------------------------------------

/**
 * A stateful, ECMAScript-compliant iterator over cron schedule occurrences.
 *
 * Implements both the _Iterator_ protocol (`.next()`) and the _Iterable_
 * protocol (`[Symbol.iterator]()`), so instances can be used directly in
 * `for…of` loops, spread expressions, and destructuring.
 *
 * Obtain an instance via {@link Cron.enumerate}.
 *
 * @example
 * ```ts
 * const job = new Cron("0 9 * * 1-5");
 * for (const date of job.enumerate()) {
 *   console.log(date);
 *   if (someCondition) break; // prevent infinite iteration
 * }
 * ```
 */
export class CronIterator implements Iterator<Date>, Iterable<Date> {
  private readonly cron: Cron;
  private cursor: Date;
  private runCount: number;

  /** @internal */
  constructor(cron: Cron, startAt?: Date) {
    this.cron = cron;
    this.cursor = startAt
      ? new Date(startAt)
      : cron.options.startAt
      ? new Date(cron.options.startAt)
      : new Date();
    this.runCount = 0;
  }

  /**
   * Advance the cursor and return the next scheduled occurrence.
   *
   * Returns `{ value: <Date>, done: false }` for each occurrence, and
   * `{ value: undefined, done: true }` when the schedule is exhausted
   * (due to `stopAt`, `maxRuns`, or no further occurrence within the
   * 4-year search window).
   */
  next(): IteratorResult<Date> {
    if (
      this.cron.options.maxRuns !== undefined &&
      this.runCount >= this.cron.options.maxRuns
    ) {
      return { value: undefined as unknown as Date, done: true };
    }

    const date = this.cron.next(this.cursor);
    if (date === null) {
      return { value: undefined as unknown as Date, done: true };
    }

    this.cursor = date;
    this.runCount++;
    return { value: date, done: false };
  }

  /**
   * Return the next scheduled date without advancing the internal cursor.
   *
   * Returns `null` when the schedule is exhausted.
   */
  peek(): Date | null {
    if (
      this.cron.options.maxRuns !== undefined &&
      this.runCount >= this.cron.options.maxRuns
    ) {
      return null;
    }
    return this.cron.next(this.cursor);
  }

  /**
   * Reset the internal cursor (and run counter) so the iterator restarts.
   *
   * @param newStartAt New starting point. Defaults to the value used at
   *   construction time (`startAt` argument → `options.startAt` → `Date.now()`).
   */
  reset(newStartAt?: Date): void {
    this.cursor = newStartAt
      ? new Date(newStartAt)
      : this.cron.options.startAt
      ? new Date(this.cron.options.startAt)
      : new Date();
    this.runCount = 0;
  }

  /**
   * Makes `CronIterator` iterable so it works in `for…of` and destructuring.
   */
  [Symbol.iterator](): this {
    return this;
  }
}
