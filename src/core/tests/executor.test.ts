import { describe, expect, test, vi } from "vitest";

vi.mock("../log/log", () => ({
    logger: {
        module: () => ({
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            fatal: () => {},
        }),
    },
}));

import { Executor } from "../api/executor";
import { defineCommand } from "../api/commands";

const add = defineCommand<{ v: number }, number>("test.add");
const addAsyncOut = defineCommand<{ v: number }, Promise<number>>(
    "test.addAsyncOut",
);

const executorWith = (handler: (i: { v: number }) => unknown) => {
    const ex = new Executor();
    ex.register(add, { hanlder: handler as never });
    return ex;
};

describe("Executor.run", () => {
    test("returns the value synchronously, not a Promise", () => {
        const ex = executorWith((i) => i.v + 1);
        const out = ex.run(add, { v: 41 });
        expect(out).toBe(42);
        expect(out).not.toBeInstanceOf(Promise);
    });

    test("afterProc sees the handler result but cannot overwrite it", () => {
        const ex = executorWith((i) => i.v + 1);
        const seen: unknown[] = [];
        ex.set_hook(add, {
            afterProc: (result, input) => {
                seen.push(result, input);
                return "ignored" as never;
            },
        });
        expect(ex.run(add, { v: 41 })).toBe(42);
        expect(seen).toEqual([42, { v: 41 }]);
    });

    test("hooks run in order: beforeProc may mutate input, afterProc gets result and input", () => {
        const ex = executorWith((i) => i.v * 2);
        const calls: string[] = [];
        ex.set_hook(add, {
            beforeProc: ({ input }) => {
                input.v += 1;
                calls.push("before1");
            },
            afterProc: (result, input) => {
                calls.push(`after1:${result}:${input.v}`);
            },
        });
        ex.set_hook(add, {
            beforeProc: () => {
                calls.push("before2");
            },
        });
        expect(ex.run(add, { v: 10 })).toBe(22);
        expect(calls).toEqual(["before1", "before2", "after1:22:11"]);
    });

    test("prevent skips the handler and afterProc", () => {
        const handler = vi.fn((i: { v: number }) => i.v);
        const ex = executorWith(handler);
        let afterRan = false;
        ex.set_hook(add, {
            beforeProc: ({ prevent }) => prevent(),
            afterProc: () => {
                afterRan = true;
            },
        });
        expect(ex.run(add, { v: 1 })).toBeUndefined();
        expect(handler).not.toHaveBeenCalled();
        expect(afterRan).toBe(false);
    });

    test("returns a Promise as-is when it is the handler's declared output", async () => {
        const ex = new Executor();
        ex.register(addAsyncOut, {
            hanlder: (i) => Promise.resolve(i.v + 1),
        });
        const out = ex.run(addAsyncOut, { v: 41 });
        expect(out).toBeInstanceOf(Promise);
        await expect(out).resolves.toBe(42);
    });

    test("throws when a hook returns a Promise", () => {
        const ex = executorWith((i) => i.v);
        ex.set_hook(add, { beforeProc: async () => {} });
        expect(() => ex.run(add, { v: 1 })).toThrow(
            "Async hook cannot run in run",
        );

        const ex2 = executorWith((i) => i.v);
        ex2.set_hook(add, { afterProc: async () => {} });
        expect(() => ex2.run(add, { v: 1 })).toThrow(
            "Async hook cannot run in run",
        );
    });

    test("throws when the handler is not registered", () => {
        const ex = new Executor();
        expect(() => ex.run(add, { v: 1 })).toThrow(
            "Handler not registered",
        );
    });
});
