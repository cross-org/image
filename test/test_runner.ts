// Re-export and adapt test utilities from @cross/test for simple function signatures
import { test as crossTest } from "@cross/test";

interface TestOptions {
  ignore?: boolean;
  only?: boolean;
  sanitizeOps?: boolean;
  sanitizeResources?: boolean;
}

/**
 * Simple test function wrapper that works with @cross/test
 */
export function test(
  name: string,
  fn: () => void | Promise<void>,
): void;
export function test(
  options: TestOptions & { name: string; fn: () => void | Promise<void> },
): void;
export function test(
  nameOrOptions:
    | string
    | (TestOptions & { name: string; fn: () => void | Promise<void> }),
  fn?: () => void | Promise<void>,
): void {
  const testName = typeof nameOrOptions === "string"
    ? nameOrOptions
    : nameOrOptions.name;
  const testFn = typeof nameOrOptions === "string" ? fn! : nameOrOptions.fn;
  const options: TestOptions = typeof nameOrOptions === "string"
    ? {}
    : nameOrOptions;

  // Convert simple function to @cross/test format
  // @cross/test expects (context, done) but our tests use simple () => void
  crossTest(testName, () => testFn(), {
    skip: options.ignore,
  });
}
