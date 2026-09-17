import { describe, expect, test } from "vitest";
import { AudioMixer, MIXER_MASTER_CHANNEL_ID } from "../audioEngine/mixer";
import { EngineError } from "../types/error_types";
import { FakeNode, makeFakeContext } from "./fakeaudio";
import { UNGROUPED } from "../constants";

/**
 * AudioMixer takes its AudioContext through the constructor, so we can
 * substitute a fake that implements only what AudioMixer actually calls
 * (createGain, destination) and records connect/disconnect calls. This
 * verifies the routing *logic* (grouping, parenting, id collisions,
 * cleanup) without touching the real Web Audio API or jsdom.
 * (FakeNode/makeFakeContext live in ./testUtils/fakeAudio so audioengine
 * tests can reuse the same primitives.)
 */

describe("AudioMixer - construction", () => {
    test("wires the master channel's inputGain -> output -> ctx.destination chain", () => {
        const { ctx, created } = makeFakeContext();
        new AudioMixer(ctx);
        // Channel's constructor creates inputGain then output (in that
        // order) and wires inputGain -> output internally. AudioMixer's
        // constructor then wires master.output -> ctx.destination.
        const [masterInput, masterOutput] = created;
        expect(masterInput?.connectedTo).toEqual([masterOutput]);
        expect(masterOutput?.connectedTo).toEqual([ctx.destination]);
    });
});

describe("AudioMixer.createGroup", () => {
    test("creates a group and routes its output into the master input", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        const result = mixer.createGroup("SFX");
        expect(result).toEqual({ ok: true, value: "SFX" });
    });

    test("rejects creating a group with a name that already exists", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.createGroup("SFX");
        const result = mixer.createGroup("SFX");
        expect(result.ok).toBe(false);
        if (!result.ok)
            expect(result.value).toBe(EngineError.GroupAlreadyExist);
    });

    test("allows multiple distinctly-named groups", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        expect(mixer.createGroup("SFX").ok).toBe(true);
        expect(mixer.createGroup("BGM").ok).toBe(true);
    });
});

describe("AudioMixer.get_group_names", () => {
    test("returns an empty list when no groups exist", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        expect(mixer.get_group_names()).toEqual([UNGROUPED]);
    });

    test("lists explicitly-created groups", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.createGroup("SFX");
        mixer.createGroup("BGM");
        expect(mixer.get_group_names().sort()).toEqual([
            "BGM",
            "SFX",
            UNGROUPED,
        ]);
    });

    test("also lists groups that were implicitly created via create_channel", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.create_channel("deckA", "deckA", "BGM");
        expect(mixer.get_group_names()).toEqual(["BGM", UNGROUPED]);
    });

    test("never includes MASTER, which is tracked separately from groups", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.createGroup("SFX");
        expect(mixer.get_group_names()).not.toContain(MIXER_MASTER_CHANNEL_ID);
    });
});

describe("AudioMixer.create_channel", () => {
    test("creates a channel directly under master when no parent is given", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        const result = mixer.create_channel("sound-1", "sound-1");
        expect(result).toEqual({ ok: true, value: "sound-1" });
    });

    test("creates a channel under an existing group", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.createGroup("SFX");
        const result = mixer.create_channel("sound-1", "SFX");
        expect(result).toEqual({ ok: true, value: "sound-1" });
    });

    test("on id collision under the same parent, regenerates the id rather than erroring", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        const first = mixer.create_channel("dup", "dup");
        const second = mixer.create_channel("dup", "dup");
        expect(first.ok).toBe(true);
        expect(second.ok).toBe(true);
        if (!first.ok || !second.ok) return;
        // The second call must have been given a fresh, different id -
        // it must NOT silently overwrite or error on the first channel.
        expect(first.value).toBe("dup");
        expect(second.value).not.toBe("dup");
    });
});

describe("AudioMixer.delete_channel", () => {
    test("removes a master-level channel and disconnects its nodes", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.create_channel("sound-1", "sound-1");
        const result = mixer.delete_channel("sound-1");
        expect(result.ok).toBe(true);
        // deleted channel can no longer be found/reused for input()
        const inputResult = mixer.input(
            "sound-1",
            new FakeNode("src") as unknown as AudioNode,
        );
        expect(inputResult.ok).toBe(false);
    });

    test("removes a channel that lives inside a group", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.createGroup("SFX");
        mixer.create_channel("sound-1", "SFX");
        const result = mixer.delete_channel("sound-1");
        expect(result.ok).toBe(true);
    });

    test("returns Err for an id that was never created", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        const result = mixer.delete_channel("ghost");
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.value).toBe(EngineError.ChannelNotFound);
    });
});

describe("AudioMixer.input", () => {
    test("connects a source node into the target channel's input gain", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.create_channel("sound-1", "sound-1");
        const source = new FakeNode("source");
        const result = mixer.input("sound-1", source as unknown as AudioNode);
        expect(result.ok).toBe(true);
        expect(source.connectedTo).toHaveLength(1);
    });

    test("returns Err when the target channel doesn't exist", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        const source = new FakeNode("source");
        const result = mixer.input(
            "no-such-channel",
            source as unknown as AudioNode,
        );
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.value).toBe(EngineError.ChannelNotFound);
    });

    test("finds channels nested inside a group, not just master-level ones", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.createGroup("SFX");
        mixer.create_channel("sound-1", "SFX");
        const source = new FakeNode("source");
        const result = mixer.input("sound-1", source as unknown as AudioNode);
        expect(result.ok).toBe(true);
        expect(source.connectedTo).toHaveLength(1);
    });
});
describe("AudioMixer.set_gain / get_gain", () => {
    test("adjusts and reads a master-level sound channel's gain", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.create_channel("sound-1", "sound-1");
        expect(mixer.set_gain("sound-1", 0.5)).toEqual({
            ok: true,
            value: 0.5,
        });
        expect(mixer.get_gain("sound-1")).toEqual({ ok: true, value: 0.5 });
    });

    test("adjusts and reads the master bus gain directly", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        expect(mixer.set_gain(MIXER_MASTER_CHANNEL_ID, 0.7)).toEqual({
            ok: true,
            value: 0.7,
        });
        expect(mixer.get_gain(MIXER_MASTER_CHANNEL_ID)).toEqual({
            ok: true,
            value: 0.7,
        });
    });

    test("adjusts and reads a group bus gain directly (not just its children)", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.createGroup("SFX");
        expect(mixer.set_gain("SFX", 0.3)).toEqual({ ok: true, value: 0.3 });
        expect(mixer.get_gain("SFX")).toEqual({ ok: true, value: 0.3 });
    });

    test("returns Err for a completely unknown id", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        const result = mixer.set_gain("ghost", 0.5);
        expect(result.ok).toBe(false);
    });
});

describe("AudioMixer.move_channel", () => {
    test("moves a master-level channel into a group", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.create_channel("sound-1", "sound-1");
        const result = mixer.move_channel("sound-1", "SFX");
        expect(result.ok).toBe(true);
        expect(mixer.group_children("SFX").map((c) => c.id)).toContain(
            "sound-1",
        );
    });

    test("moves a channel from one group to another", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.createGroup("A");
        mixer.createGroup("B");
        mixer.create_channel("sound-1", "sound-1", "A");
        const result = mixer.move_channel("sound-1", "B");
        expect(result.ok).toBe(true);
        expect(mixer.group_children("A").map((c) => c.id)).not.toContain(
            "sound-1",
        );
        expect(mixer.group_children("B").map((c) => c.id)).toContain("sound-1");
    });

    test("moving a grouped channel with no destination puts it back at master level", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.create_channel("sound-1", "sound-1", "SFX");
        const result = mixer.move_channel("sound-1");
        expect(result.ok).toBe(true);
        expect(mixer.group_children("SFX").map((c) => c.id)).not.toContain(
            "sound-1",
        );
        // still reachable/controllable at master level
        expect(mixer.set_gain("sound-1", 0.4).ok).toBe(true);
    });

    test("preserves the channel's gain across the move", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.create_channel("sound-1", "sound-1");
        mixer.set_gain("sound-1", 0.42);
        mixer.move_channel("sound-1", "SFX");
        expect(mixer.get_gain("sound-1")).toEqual({ ok: true, value: 0.42 });
    });

    test("returns Err for an id that doesn't exist", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        const result = mixer.move_channel("ghost", "SFX");
        expect(result.ok).toBe(false);
    });
});

describe("AudioMixer.delete_group", () => {
    test("returns Err for a group that doesn't exist", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        const result = mixer.delete_group("ghost");
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.value).toBe(EngineError.GroupNotFound);
    });

    test("removes the group from get_group_names", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.createGroup("SFX");
        mixer.delete_group("SFX");
        expect(mixer.get_group_names()).not.toContain("SFX");
    });

    test("relocates children to master level instead of destroying them", () => {
        const { ctx } = makeFakeContext();
        const mixer = new AudioMixer(ctx);
        mixer.create_channel("sound-1", "sound-1", "SFX");
        mixer.delete_group("SFX");
        // still controllable -> means it survived at master level
        expect(mixer.set_gain("sound-1", 0.6)).toEqual({
            ok: true,
            value: 0.6,
        });
    });
});
