import { describe, expect, test, vi, afterEach, beforeAll } from "vitest";

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
import { Executor } from "../api/executor";
import { EngineCommands } from "../audioEngine/commands";
import { remoteCommands } from "../sidecar/remoteCommands";
import { createSideCarPlugin } from "../sidecar/plugin";
import { Ok } from "../types/types";
import type {
    SideCar,
    SideCarCommand,
    SideCarCommandPayload,
} from "../sidecar/sidecar";
import type { SideCarHostRelay } from "../sidecar/sidecarHost";

let Relay: typeof SideCarHostRelay;

beforeAll(async () => {
    installBrowserGlobals(vi);
    setActivePinia(createPinia());
    await import("../index");
    ({ SideCarHostRelay: Relay } = await import("../sidecar/sidecarHost"));
});

afterEach(() => {
    vi.unstubAllGlobals();
});

interface Case {
    cmd: SideCarCommand;
    input?: unknown;
    payload: SideCarCommandPayload;
    received: unknown;
}

const cases: Case[] = [
    {
        cmd: "play",
        input: {
            id: "sfx1",
            options: {
                start: 1,
                end: 2,
                beforestart: () => {},
                onended: () => {},
            },
        },
        payload: {
            cmd: "play",
            id: "sfx1",
            options: { start: 1, end: 2 },
        },
        received: { id: "sfx1", options: { start: 1, end: 2 } },
    },
    {
        cmd: "stop",
        input: { source_id: "sfx1" },
        payload: { cmd: "stop", source_id: "sfx1" },
        received: { source_id: "sfx1" },
    },
    {
        cmd: "stop_all_sfx",
        payload: { cmd: "stop_all_sfx" },
        received: undefined,
    },
    {
        cmd: "ducking",
        payload: { cmd: "ducking" },
        received: undefined,
    },
    {
        cmd: "set_gain",
        input: { id: "deckA", gain: 0.5, initialised: true },
        payload: {
            cmd: "set_gain",
            id: "deckA",
            gain: 0.5,
            initialising: true,
        },
        received: { id: "deckA", gain: 0.5, initialised: true },
    },
    {
        cmd: "play_bgm",
        input: { id: "deckA" },
        payload: { cmd: "play_bgm", deck: "deckA" },
        received: { id: "deckA" },
    },
    {
        cmd: "pause_bgm",
        input: { id: "deckB" },
        payload: { cmd: "pause_bgm", deck: "deckB" },
        received: { id: "deckB" },
    },
    {
        cmd: "stop_bgm",
        input: { id: "deckA" },
        payload: { cmd: "stop_bgm", deck: "deckA" },
        received: { id: "deckA" },
    },
    {
        cmd: "seek_bgm",
        input: { id: "deckB", time: 12.5 },
        payload: { cmd: "seek_bgm", deck: "deckB", time: 12.5 },
        received: { id: "deckB", time: 12.5 },
    },
    {
        cmd: "load_bgm_to_deck",
        input: { id: "deckA", bgmId: "bgm1" },
        payload: { cmd: "load_bgm_to_deck", deck: "deckA", bgmId: "bgm1" },
        received: { id: "deckA", bgmId: "bgm1" },
    },
    {
        cmd: "eject_bgm",
        input: { id: "deckB" },
        payload: { cmd: "eject_bgm", deck: "deckB" },
        received: { id: "deckB" },
    },
    {
        cmd: "toggleloop",
        input: { id: "deckA" },
        payload: { cmd: "toggleloop", id: "deckA" },
        received: { id: "deckA" },
    },
];

const recordingExecutor = () => {
    const executor = new Executor();
    const calls: { name: string; input: unknown }[] = [];
    for (const command of Object.values(EngineCommands)) {
        executor.register(command, {
            handler: ((input: unknown) => {
                calls.push({ name: command.name, input });
                return { echoed: input };
            }) as never,
        });
    }
    return { executor, calls };
};

describe("remote command round trip (visitor -> host)", () => {
    test("the case list covers every remote command in the table", () => {
        expect(cases).toHaveLength(remoteCommands.length);
        for (const def of remoteCommands) {
            expect(cases.some((c) => c.cmd === def.cmd)).toBe(true);
        }
    });

    test.each(cases)(
        "$cmd: plugin payload reaches the matching engine command on the host",
        (c) => {
            const def = remoteCommands.find((d) => d.cmd === c.cmd)!;

            const sent: SideCarCommandPayload[] = [];
            const sidecar = {
                mode: "visitor",
                send_command: vi.fn((payload: SideCarCommandPayload) => {
                    sent.push(payload);
                    return Ok();
                }),
            } as unknown as SideCar;
            const visitor = recordingExecutor();
            createSideCarPlugin(sidecar).install(visitor.executor);

            if (c.input === undefined) {
                visitor.executor.run(def.command);
            } else {
                visitor.executor.run(def.command, c.input);
            }
            expect(visitor.calls).toHaveLength(0);
            expect(sent).toHaveLength(1);
            expect(sent[0]).toEqual(c.payload);

            const wire = JSON.parse(
                JSON.stringify(sent[0]),
            ) as SideCarCommandPayload;
            expect(wire).toEqual(c.payload);

            const host = recordingExecutor();
            const relay = new Relay(
                host.executor,
                {} as unknown as SideCar,
            );
            relay.executeRemote(wire);
            expect(host.calls).toEqual([
                { name: def.command.name, input: c.received },
            ]);
        },
    );
});
