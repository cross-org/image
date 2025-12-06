// Test utilities that work with Deno's built-in test runner

interface TestOptions {
  ignore?: boolean;
  only?: boolean;
  sanitizeOps?: boolean;
  sanitizeResources?: boolean;
}

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
  if (typeof nameOrOptions === "string") {
    Deno.test(nameOrOptions, fn!);
  } else {
    Deno.test(nameOrOptions);
  }
}
