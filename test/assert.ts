// Minimal assert utilities for environments without JSR access
// This is a fallback for when @std/assert is not available

export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

export function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  if (actual !== expected) {
    const message = msg || `Expected ${expected} but got ${actual}`;
    throw new AssertionError(message);
  }
}

export function assertExists<T>(
  actual: T,
  msg?: string,
): asserts actual is NonNullable<T> {
  if (actual === undefined || actual === null) {
    const message = msg || `Expected value to exist but got ${actual}`;
    throw new AssertionError(message);
  }
}

export async function assertRejects(
  fn: () => Promise<unknown>,
  ErrorClass?: ErrorConstructor,
  msgIncludes?: string,
  msg?: string,
): Promise<void> {
  let hasThrown = false;
  let error: Error | undefined;

  try {
    await fn();
  } catch (e) {
    hasThrown = true;
    error = e as Error;
  }

  if (!hasThrown) {
    throw new AssertionError(msg || "Expected function to reject");
  }

  if (ErrorClass && !(error instanceof ErrorClass)) {
    throw new AssertionError(
      msg || `Expected error to be instance of ${ErrorClass.name}`,
    );
  }

  if (msgIncludes && !error?.message.includes(msgIncludes)) {
    throw new AssertionError(
      msg || `Expected error message to include "${msgIncludes}"`,
    );
  }
}

export function assertThrows(
  fn: () => unknown,
  ErrorClass?: ErrorConstructor,
  msgIncludes?: string,
  msg?: string,
): void {
  let hasThrown = false;
  let error: Error | undefined;

  try {
    fn();
  } catch (e) {
    hasThrown = true;
    error = e as Error;
  }

  if (!hasThrown) {
    throw new AssertionError(msg || "Expected function to throw");
  }

  if (ErrorClass && !(error instanceof ErrorClass)) {
    throw new AssertionError(
      msg || `Expected error to be instance of ${ErrorClass.name}`,
    );
  }

  if (msgIncludes && !error?.message.includes(msgIncludes)) {
    throw new AssertionError(
      msg || `Expected error message to include "${msgIncludes}"`,
    );
  }
}
