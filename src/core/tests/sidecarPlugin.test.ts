import { describe, expect, test, vi } from "vitest";

vi.mock("../log/log", () => ({
    LogCategory: {
        NETWORK: "NETWORK",
        SYSTEM: "SYSTEM",
        FILE: "FILE",
        AUDIO: "AUDIO",
        EVENT: "EVENT",
    },
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
import { EngineCommands } from "../audioEngine/commands";
import { createSideCarPlugin } from "../sidecar/plugin";
import { Ok, type Result } from "../types/types";
import type { SideCar } from "../sidecar/sidecar";

const setup = (mode: "host" | "visitor" | undefined) => {
    const send_command = vi.fn(() => Ok());
    const sidecar = { mode, send_command } as unknown as SideCar;
    const executor = new Executor();
    const handler = vi.fn((input: unknown) => ({ echoed: input }));
    executor.register(EngineCommands.play, { hanlder: handler as never });
    executor.register(EngineCommands.set_gain, { hanlder: handler as never });
    executor.register(EngineCommands.loop_bgm, { hanlder: handler as never });
    createSideCarPlugin(sidecar).install(executor);
    return { executor, handler, send_command };
};

describe("SideCar plugin (visitor)", () => {
    test("forwards play to the host and prevents local execution", async () => {
        const { executor, handler, send_command } = setup("visitor");
        const out = await executor.run(EngineCommands.play, {
            id: "sfx1",
            options: { start: 1, end: 2 },
        });
        expect(out).toBeUndefined();
        expect(handler).not.toHaveBeenCalled();
        expect(send_command).toHaveBeenCalledWith({
            cmd: "play",
            id: "sfx1",
            options: { start: 1, end: 2 },
        });
    });

    test("maps set_gain initialised to the protocol field initialising", async () => {
        const { executor, handler, send_command } = setup("visitor");
        await executor.run(EngineCommands.set_gain, {
            id: "deckA",
            gain: 0.5,
            initialised: true,
        });
        expect(handler).not.toHaveBeenCalled();
        expect(send_command).toHaveBeenCalledWith({
            cmd: "set_gain",
            id: "deckA",
            gain: 0.5,
            initialising: true,
        });
    });

    test("maps loop_bgm to toggleloop", async () => {
        const { executor, send_command } = setup("visitor");
        await executor.run(EngineCommands.loop_bgm, { id: "deckB" });
        expect(send_command).toHaveBeenCalledWith({
            cmd: "toggleloop",
            id: "deckB",
        });
    });
});

describe("SideCar plugin (not a visitor)", () => {
    test("does not intervene when mode is undefined", async () => {
        const { executor, handler, send_command } = setup(undefined);
        const out = (await executor.run(EngineCommands.play, {
            id: "sfx1",
        })) as Result<unknown, unknown> | { echoed: unknown };
        expect(handler).toHaveBeenCalled();
        expect(send_command).not.toHaveBeenCalled();
        expect(out).toEqual({ echoed: { id: "sfx1" } });
    });

    test("does not intervene when hosting", async () => {
        const { executor, handler, send_command } = setup("host");
        await executor.run(EngineCommands.set_gain, { id: "x", gain: 1 });
        expect(handler).toHaveBeenCalled();
        expect(send_command).not.toHaveBeenCalled();
    });
});
