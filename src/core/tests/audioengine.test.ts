import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { AudioEngine, PlayerEvent } from "../audioEngine/audioengine";
import { SFXPlayMode } from "../audioEngine/sounds";
import { AudioEngineError } from "../types/err";
import {
    FakeAudioContext,
    FakeAudioBufferSourceNode,
    FakeAudioElement,
    installBrowserGlobals,
    makeFakeAudioBuffer,
} from "./fakeaudio";
import { UNGROUPED } from "../constants";

/**
 * Engine hardcodes `new window.AudioContext()` and BGMPlayer hardcodes
 * `document.createElement("audio")`, so - unlike AudioMixer, which takes
 * its ctx via the constructor - there's no way to inject fakes through the
 * public API. Instead we stub the handful of browser globals it reaches
 * for (see testUtils/fakeAudio.ts) before constructing it. Node 22 already
 * provides EventTarget/CustomEvent/Blob/URL.createObjectURL natively, so
 * this needs no jsdom.
 */

function setupEngine() {
    installBrowserGlobals(vi);
    const engine = new AudioEngine();
    const ctx = FakeAudioContext.instances.at(-1);
    if (!ctx) throw new Error("Engine did not construct a FakeAudioContext");
    return { engine, ctx };
}

const dummySfxBuffer = () => new ArrayBuffer(8);
const dummyBgmBlob = () => new Blob(["fake-bgm-bytes"], { type: "audio/mp3" });

beforeEach(() => {
    setActivePinia(createPinia());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("Engine construction", () => {
    test("wires deckA/deckB into a BGM group via the mixer", () => {
        const { engine } = setupEngine();
        expect(engine.get_group_names()).toEqual(["BGM", UNGROUPED]);
        const ids = engine
            .get_group_children("BGM")
            .map((c) => c.id)
            .sort();
        expect(ids).toEqual(["deckA", "deckB"]);
    });

    test("creates exactly two <audio> elements (one per deck)", () => {
        setupEngine();
        expect(FakeAudioElement.instances).toHaveLength(2);
    });
});

describe("Engine.add_sfx / get_sfx_library", () => {
    test("decodes the buffer, stores it, and creates a mixer channel under the default SFX group", async () => {
        const { engine, ctx } = setupEngine();
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
        });
        expect(result.ok).toBe(true);
        expect(ctx.decodeCalls).toHaveLength(1);
        if (!result.ok) return;
        expect(engine.get_sfx_library()[result.value]?.filename).toBe(
            "kick.wav",
        );
        expect(engine.get_group_children("SFX").map((c) => c.id)).toContain(
            result.value,
        );
    });

    test("respects an explicit group and initial gain", async () => {
        const { engine } = setupEngine();
        const result = await engine.add_sfx({
            name: "riser.wav",
            file: dummySfxBuffer(),
            id: undefined,
            group: "Ambience",
            gain: 0.5,
        });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(engine.get_gain(result.value)).toEqual({
            ok: true,
            value: 0.5,
        });
        expect(
            engine.get_group_children("Ambience").map((c) => c.id),
        ).toContain(result.value);
    });
});

describe("Engine.add_sfx concurrency + reorder_sfx", () => {
    test("reorder_sfx after concurrently decoding sounds restores the intended order, regardless of which one finishes decoding first", async () => {
        const { engine, ctx } = setupEngine();
        const delayByMarker: Record<number, number> = {
            0: 120,
            1: 80,
            2: 40,
            3: 0,
        };
        ctx.decodeAudioData = (data: ArrayBuffer) => {
            ctx.decodeCalls.push(data);
            const marker = new Uint8Array(data)[0] ?? 0;
            const delay = delayByMarker[marker] ?? 0;
            return new Promise((resolve) =>
                setTimeout(
                    () =>
                        resolve(
                            makeFakeAudioBuffer() as unknown as AudioBuffer,
                        ),
                    delay,
                ),
            );
        };

        const sounds = [0, 1, 2, 3].map((marker) => ({
            id: `s${marker}`,
            file: new Uint8Array([marker]).buffer,
        }));

        await Promise.all(
            sounds.map((s) =>
                engine.add_sfx({ name: `${s.id}.wav`, file: s.file, id: s.id }),
            ),
        );
        engine.reorder_sfx(sounds.map((s) => s.id));

        expect(Object.keys(engine.get_sfx_library())).toEqual([
            "s0",
            "s1",
            "s2",
            "s3",
        ]);
    });
});

describe("Engine.play - SFXPlayMode branching", () => {
    async function addSfx(engine: AudioEngine, mode: SFXPlayMode) {
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
        });
        if (!result.ok) throw new Error("setup failed");
        engine.set_sfx_play_mode(result.value, mode);
        return result.value;
    }

    test("OverLap (default): the same sound can be started multiple times concurrently", async () => {
        const { engine } = setupEngine();
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
        });
        if (!result.ok) throw new Error("setup failed");
        const first = await engine.play(result.value);
        const second = await engine.play(result.value);
        expect(first).toEqual({
            ok: true,
            value: {
                played: true,
                soundID: result.value,
                sourceID: expect.any(String),
            },
        });
        expect(second.ok).toBe(true);
        expect(FakeAudioBufferSourceNode.instances).toHaveLength(2);
        expect(
            FakeAudioBufferSourceNode.instances.every((n) => n.started),
        ).toBe(true);
    });

    test("Restart: starting again stops the currently-playing instance first", async () => {
        const { engine } = setupEngine();
        const id = await addSfx(engine, SFXPlayMode.Restart);
        await engine.play(id);
        const firstNode = FakeAudioBufferSourceNode.instances[0];
        await engine.play(id);
        expect(firstNode?.stopped).toBe(true);
        expect(FakeAudioBufferSourceNode.instances).toHaveLength(2);
    });

    test("Ignore: a second play() while one is active is a no-op and reports played:false", async () => {
        const { engine } = setupEngine();
        const id = await addSfx(engine, SFXPlayMode.Ignore);
        await engine.play(id);
        const second = await engine.play(id);
        expect(second).toEqual({ ok: true, value: { played: false } });
        // Note: SoundLibrary.get_PlayInfo() constructs a fresh
        // AudioBufferSourceNode unconditionally, before the play-mode
        // branch runs - so the "ignored" call still allocates a node, it
        // just never gets .start()ed. Documenting actual behaviour here
        // rather than the (cheaper) behaviour one might expect.
        expect(FakeAudioBufferSourceNode.instances).toHaveLength(2);
        expect(FakeAudioBufferSourceNode.instances[1]?.started).toBe(false);
    });

    test("Stop: a second play() while one is active stops it and reports played:false, without starting a new one", async () => {
        const { engine } = setupEngine();
        const id = await addSfx(engine, SFXPlayMode.Stop);
        await engine.play(id);
        const firstNode = FakeAudioBufferSourceNode.instances[0];
        const second = await engine.play(id);
        expect(second).toEqual({ ok: true, value: { played: false } });
        expect(firstNode?.stopped).toBe(true);
        // Same unused-allocation note as the Ignore case above.
        expect(FakeAudioBufferSourceNode.instances).toHaveLength(2);
        expect(FakeAudioBufferSourceNode.instances[1]?.started).toBe(false);
    });

    test("returns Err(SoundNotFound) for an unknown id", async () => {
        const { engine } = setupEngine();
        const result = await engine.play("no-such-sound");
        expect(result).toEqual({
            ok: false,
            value: AudioEngineError.SoundNotFound,
        });
    });

    test("clears playing state once the node naturally ends", async () => {
        const { engine } = setupEngine();
        const id = await addSfx(engine, SFXPlayMode.Restart);
        await engine.play(id);
        const node = FakeAudioBufferSourceNode.instances[0];
        node?.onended?.(new Event("ended"));
        // If ended-cleanup didn't run, this second play would be treated as
        // "already playing" (Restart stops+replaces instead of just adding).
        await engine.play(id);
        expect(node?.stopped).toBe(false);
    });
});

describe("Engine.play - trimming", () => {
    test("passes explicit start/end options straight to the source node", async () => {
        const { engine } = setupEngine();
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
        });
        if (!result.ok) throw new Error("setup failed");
        await engine.play(result.value, { start: 0.2, end: 0.8 });
        const node = FakeAudioBufferSourceNode.instances[0];
        // fake buffer duration is 1s; expect (when, offset, duration)
        expect(node?.startArgs).toEqual([0, 0.2, expect.closeTo(0.6, 5)]);
    });

    test("falls back to a persisted trim when no options are given", async () => {
        const { engine } = setupEngine();
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
        });
        if (!result.ok) throw new Error("setup failed");
        engine.trim(result.value, 0.1, 0.4);
        await engine.play(result.value);
        const node = FakeAudioBufferSourceNode.instances[0];
        expect(node?.startArgs).toEqual([0, 0.1, expect.closeTo(0.3, 5)]);
    });

    test("plays the full buffer when neither options nor a persisted trim exist", async () => {
        const { engine } = setupEngine();
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
        });
        if (!result.ok) throw new Error("setup failed");
        await engine.play(result.value);
        const node = FakeAudioBufferSourceNode.instances[0];
        expect(node?.startArgs).toEqual([undefined, undefined, undefined]);
    });
});

describe("Engine ctx resume (iOS suspended/interrupted handling)", () => {
    test("resumes a suspended context before playing", async () => {
        const { engine, ctx } = setupEngine();
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
        });
        if (!result.ok) throw new Error("setup failed");
        ctx.state = "suspended";
        await engine.play(result.value);
        expect(ctx.resumeCallCount).toBe(1);
        expect(ctx.state).toBe("running");
    });

    test("also resumes from the non-standard iOS 'interrupted' state", async () => {
        const { engine, ctx } = setupEngine();
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
        });
        if (!result.ok) throw new Error("setup failed");
        ctx.state = "interrupted";
        await engine.play(result.value);
        expect(ctx.resumeCallCount).toBe(1);
    });

    test("does not call resume() when already running", async () => {
        const { engine, ctx } = setupEngine();
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
        });
        if (!result.ok) throw new Error("setup failed");
        await engine.play(result.value);
        expect(ctx.resumeCallCount).toBe(0);
    });
});

describe("Engine.discard_sound", () => {
    test("removes the sound from the library and its mixer channel", async () => {
        const { engine } = setupEngine();
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
        });
        if (!result.ok) throw new Error("setup failed");
        engine.discard_sound(result.value);
        expect(engine.get_sfx_library()[result.value]).toBeUndefined();
        expect(engine.get_group_children("SFX").map((c) => c.id)).not.toContain(
            result.value,
        );
    });

    test("stops any in-flight playback of that sound first", async () => {
        const { engine } = setupEngine();
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
        });
        if (!result.ok) throw new Error("setup failed");
        await engine.play(result.value);
        const node = FakeAudioBufferSourceNode.instances[0];
        engine.discard_sound(result.value);
        expect(node?.stopped).toBe(true);
    });
});

describe("Engine group management", () => {
    test("move_channel_to_group moves the mixer channel and updates library metadata", async () => {
        const { engine } = setupEngine();
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
        });
        if (!result.ok) throw new Error("setup failed");
        const moved = engine.move_channel_to_group(result.value, "Drums");
        expect(moved.ok).toBe(true);
        expect(engine.get_group_children("Drums").map((c) => c.id)).toContain(
            result.value,
        );
        expect(engine.get_soundinfo(result.value)?.group).toBe("Drums");
    });

    test("delete_group relocates its children instead of destroying them", async () => {
        const { engine } = setupEngine();
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
            id: undefined,
            group: "Drums",
        });
        if (!result.ok) throw new Error("setup failed");
        const deleted = engine.delete_group("Drums");
        expect(deleted.ok).toBe(true);
        // survived at master level -> still controllable
        expect(engine.set_gain(result.value, 0.9).ok).toBe(true);
    });
});

describe("Engine BGM deck control", () => {
    test("load_bgm_to_deck surfaces SoundNotFound for an unknown bgm id", () => {
        const { engine } = setupEngine();
        const result = engine.load_bgm_to_deck("deckA", "no-such-bgm");
        expect(result).toEqual({
            ok: false,
            value: AudioEngineError.SoundNotFound,
        });
    });

    test("load -> play -> pause round-trips through the real Deck/BGMPlayer event chain", () => {
        const { engine } = setupEngine();
        const added = engine.add_bgm({
            name: "set1.mp3",
            file: dummyBgmBlob(),
        });
        expect(added.ok).toBe(true);
        if (!added.ok) return;

        expect(engine.load_bgm_to_deck("deckA", added.value).ok).toBe(true);
        expect(engine.get_bgm_info("deckA").meta?.filename).toBe("set1.mp3");

        const playHandler = vi.fn();
        const pauseHandler = vi.fn();
        engine.addEventListener(PlayerEvent.play, playHandler);
        engine.addEventListener(PlayerEvent.pause, pauseHandler);

        engine.play_bgm("deckA");
        expect(engine.get_bgm_info("deckA").playing).toBe(true);
        expect(playHandler).toHaveBeenCalledTimes(1);
        expect(playHandler.mock.calls[0]?.[0].detail).toEqual({
            deck: "deckA",
        });

        engine.pause_bgm("deckA");
        expect(engine.get_bgm_info("deckA").playing).toBe(false);
        expect(pauseHandler).toHaveBeenCalledTimes(1);
    });

    test("deckA and deckB are independent", () => {
        const { engine } = setupEngine();
        const a = engine.add_bgm({ name: "a.mp3", file: dummyBgmBlob() });
        const b = engine.add_bgm({ name: "b.mp3", file: dummyBgmBlob() });
        if (!a.ok || !b.ok) throw new Error("setup failed");
        engine.load_bgm_to_deck("deckA", a.value);
        engine.load_bgm_to_deck("deckB", b.value);

        engine.play_bgm("deckA");

        expect(engine.get_bgm_info("deckA").playing).toBe(true);
        expect(engine.get_bgm_info("deckB").playing).toBe(false);
        expect(engine.get_bgm_info("deckB").meta?.filename).toBe("b.mp3");
    });

    test("seek_bgm updates current_time", () => {
        const { engine } = setupEngine();
        const added = engine.add_bgm({
            name: "set1.mp3",
            file: dummyBgmBlob(),
        });
        if (!added.ok) throw new Error("setup failed");
        engine.load_bgm_to_deck("deckA", added.value);
        engine.seek_bgm("deckA", 42);
        expect(engine.get_bgm_info("deckA").current_time).toBe(42);
    });

    test("unload_bgm clears the deck's metadata", () => {
        const { engine } = setupEngine();
        const added = engine.add_bgm({
            name: "set1.mp3",
            file: dummyBgmBlob(),
        });
        if (!added.ok) throw new Error("setup failed");
        engine.load_bgm_to_deck("deckA", added.value);
        engine.unload_bgm("deckA");
        expect(engine.get_bgm_info("deckA").meta).toBeNull();
    });

    test("duration normalises to 0 before metadata has loaded (NaN -> 0)", () => {
        const { engine } = setupEngine();
        const added = engine.add_bgm({
            name: "set1.mp3",
            file: dummyBgmBlob(),
        });
        if (!added.ok) throw new Error("setup failed");
        engine.load_bgm_to_deck("deckA", added.value);
        expect(engine.get_bgm_info("deckA").duration).toBe(0);
    });
});

describe("Engine.dispose", () => {
    test("closes the audio context and stops all playing sfx", async () => {
        const { engine, ctx } = setupEngine();
        const result = await engine.add_sfx({
            name: "kick.wav",
            file: dummySfxBuffer(),
        });
        if (!result.ok) throw new Error("setup failed");
        await engine.play(result.value);
        const node = FakeAudioBufferSourceNode.instances[0];

        await engine.dispose();

        expect(node?.stopped).toBe(true);
        expect(ctx.closeCallCount).toBe(1);
    });
});
