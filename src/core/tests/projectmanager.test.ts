import { describe, expect, test, vi, afterEach } from "vitest";

vi.mock("../log/log", () => ({
    LogLevel: {
        DEBUG: "DEBUG",
        INFO: "INFO",
        WARN: "WARN",
        ERROR: "ERROR",
        FATAL: "FATAL",
    },
    LogCategory: {
        NETWORK: "NETWORK",
        SYSTEM: "SYSTEM",
        FILE: "FILE",
        AUDIO: "AUDIO",
        EVENT: "EVENT",
    },
    log_list: [],
    logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
        module: () => ({
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
            fatal: () => {},
        }),
    },
}));

import { createPinia, setActivePinia } from "pinia";
import { installBrowserGlobals } from "./fakeaudio";
import { EngineCommands } from "../audioEngine/commands";
import { EngineEvent } from "../types/types";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("ProjectManager error notification hook", () => {
    test("dispatches EngineEvent.Error when a command fails", async () => {
        installBrowserGlobals(vi);
        setActivePinia(createPinia());
        const { ProjectManager: pm } = await import("../index");
        const errors: unknown[] = [];
        pm.addEventListener(EngineEvent.Error, (e) => {
            errors.push((e as CustomEvent).detail);
        });
        const first = await pm.run(EngineCommands.create_group, {
            name: "TestGroup",
        });
        expect(first.ok).toBe(true);
        expect(errors).toHaveLength(0);
        const second = await pm.run(EngineCommands.create_group, {
            name: "TestGroup",
        });
        expect(second.ok).toBe(false);
        expect(errors).toHaveLength(1);
    });
});
