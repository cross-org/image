// Test utilities that work across Deno, Bun, and Node.js

interface TestOptions {
  ignore?: boolean;
  only?: boolean;
  sanitizeOps?: boolean;
  sanitizeResources?: boolean;
}

// Detect runtime
// @ts-ignore - runtime globals
const isDeno = typeof Deno !== "undefined" && Deno.test !== undefined;
// @ts-ignore - runtime globals
const isBun = typeof Bun !== "undefined" && typeof Bun.test !== "undefined";
// @ts-ignore - runtime globals
const nodeTestGlobal = !isDeno && !isBun && typeof test !== "undefined";

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
  if (isDeno) {
    // Use Deno's test runner
    // @ts-ignore - Deno global
    if (typeof nameOrOptions === "string") {
      // @ts-ignore - Deno global
      Deno.test(nameOrOptions, fn!);
    } else {
      // @ts-ignore - Deno global
      Deno.test(nameOrOptions);
    }
  } else if (isBun) {
    // Use Bun's test runner
    const testName = typeof nameOrOptions === "string"
      ? nameOrOptions
      : nameOrOptions.name;
    const testFn = typeof nameOrOptions === "string" ? fn! : nameOrOptions.fn;
    const options: TestOptions = typeof nameOrOptions === "string"
      ? {}
      : nameOrOptions;

    if (options.ignore) {
      // @ts-ignore - Bun global
      Bun.test.skip(testName, testFn);
    } else if (options.only) {
      // @ts-ignore - Bun global
      Bun.test.only(testName, testFn);
    } else {
      // @ts-ignore - Bun global
      Bun.test(testName, testFn);
    }
  } else if (nodeTestGlobal) {
    // Node.js with tsx --test provides a global test function
    const testName = typeof nameOrOptions === "string"
      ? nameOrOptions
      : nameOrOptions.name;
    const testFn = typeof nameOrOptions === "string" ? fn! : nameOrOptions.fn;
    const options: TestOptions = typeof nameOrOptions === "string"
      ? {}
      : nameOrOptions;

    if (options.ignore) {
      // @ts-ignore - Node test global
      globalThis.test.skip(testName, testFn);
    } else if (options.only) {
      // @ts-ignore - Node test global
      globalThis.test.only(testName, testFn);
    } else {
      // @ts-ignore - Node test global
      globalThis.test(testName, testFn);
    }
  }
}
