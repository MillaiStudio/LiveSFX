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
import {
    EngineCommands,
    registerEngineCommands,
} from "../audioEngine/commands";
import type { AudioEngine } from "../audioEngine/audioengine";

const makeEngine = (label: string) =>
    ({
        play: vi.fn(async (id: string) => ({ label, id })),
        set_gain: vi.fn((id: string, gain: number) => ({ label, id, gain })),
        get_group_names: vi.fn(() => [label]),
    }) as unknown as AudioEngine & {
        play: ReturnType<typeof vi.fn>;
        set_gain: ReturnType<typeof vi.fn>;
        get_group_names: ReturnType<typeof vi.fn>;
    };

describe("registerEngineCommands", () => {
    test("commands reach the current engine after a swap, without re-registering", async () => {
        const engineA = makeEngine("A");
        const engineB = makeEngine("B");
        let current = engineA as AudioEngine;
        const executor = new Executor();
        registerEngineCommands(executor, () => current);

        await executor.run(EngineCommands.play, { id: "sfx1" });
        expect(engineA.play).toHaveBeenCalledWith("sfx1", undefined);
        expect(engineB.play).not.toHaveBeenCalled();

        current = engineB as AudioEngine;

        const played = await executor.run(EngineCommands.play, {
            id: "sfx2",
        });
        expect(played).toEqual({ label: "B", id: "sfx2" });
        expect(engineB.play).toHaveBeenCalledTimes(1);
        expect(engineA.play).toHaveBeenCalledTimes(1);

        executor.run(EngineCommands.set_gain, { id: "deckA", gain: 0.5 });
        expect(engineB.set_gain).toHaveBeenCalledWith("deckA", 0.5);
        expect(engineA.set_gain).not.toHaveBeenCalled();

        expect(executor.run(EngineCommands.get_group_names)).toEqual(["B"]);
        expect(engineA.get_group_names).not.toHaveBeenCalled();
    });
});
