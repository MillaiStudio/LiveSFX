import { defineCommand as d } from "../api/commands";
import type { Executor } from "../api/executor";
import type { AudioEngineError, AudioMixerError } from "../types/err";
import type { Result } from "../types/types";
import type { AudioEngine, DeckID, PlayResult } from "./audioengine";
import type { MixerChannelSnapshot } from "./mixer";
import type { BGMFile, SFXPlayMode, SoundMeta } from "./sounds";

type playType = {
    input: {
        id: string;
        options?: {
            start?: number;
            end?: number;
            beforestart?: (id: string) => void;
            onended?: (id: string) => void;
        };
    };
    output: Promise<Result<PlayResult, AudioEngineError>>;
};

const commands = {
    play: d<playType["input"], playType["output"]>("engine.play"),
    stop: d<{ source_id: string }, void>("engine.stop"),
    stop_all_sfx: d<void, void>("engine.stop_all_sfx"),
    trim: d<{ id: string; start: number; end: number }, void>("engine.trim"),
    set_sfx_play_mode: d<{ id: string; mode: SFXPlayMode }, void>(
        "engine.set_sfx_play_mode",
    ),
    discard_sound: d<{ id: string }, void>("engine.discard_sound"),
    create_group: d<{ name: string }, Result<string, string>>(
        "engine.create_group",
    ),
    delete_group: d<{ name: string }, Result<void, string>>(
        "engine.delete_group",
    ),
    rename_group: d<{ oldName: string; newName: string }, Result<void, string>>(
        "engine.rename_group",
    ),
    move_sound_to_group: d<
        { id: string; newGroup?: string },
        Result<void, string>
    >("engine.move_sound_to_group"),
    move_sound: d<{ id: string; toIndex: number }, Result<void, string>>(
        "engine.move_sound",
    ),
    rename: d<{ id: string; name: string }, Result<void, string>>(
        "engine.rename",
    ),
    set_gain: d<
        { id: string; gain: number; initialised?: boolean },
        Result<number, AudioMixerError>
    >("engine.set_gain"),
    ducking: d<void, Result<boolean, AudioMixerError>>("engine.ducking"),
    load_bgm: d<{ id: DeckID; file: BGMFile }, void>("engine.load_bgm"),
    play_bgm: d<{ id: DeckID }, void>("engine.play_bgm"),
    pause_bgm: d<{ id: DeckID }, void>("engine.pause_bgm"),
    stop_bgm: d<{ id: DeckID }, void>("engine.stop_bgm"),
    seek_bgm: d<{ id: DeckID; time: number }, void>("engine.seek_bgm"),
    unload_bgm: d<{ id: DeckID }, void>("engine.unload_bgm"),
    load_bgm_to_deck: d<
        { id: DeckID; bgmId: string },
        Result<void, AudioEngineError>
    >("engine.load_bgm_to_deck"),
    loop_bgm: d<{ id: DeckID }, void>("engine.loop_bgm"),
    get_sfx_library: d<void, Record<string, SoundMeta>>(
        "engine.get_sfx_library",
    ),
    get_bgm_library: d<void, Record<string, SoundMeta>>(
        "engine.get_bgm_library",
    ),
    get_group_names: d<void, string[]>("engine.get_group_names"),
    get_all_channels: d<void, MixerChannelSnapshot[]>(
        "engine.get_all_channels",
    ),
};

export const registerEngineCommands = (
    executor: Executor,
    getEngine: () => AudioEngine,
) => {
    executor.register(commands.play, {
        handler: (input) => getEngine().play(input.id, input.options),
    });
    executor.register(commands.stop, {
        handler: (input) => getEngine().stop(input.source_id),
    });
    executor.register(commands.stop_all_sfx, {
        handler: () => getEngine().stop_all_sfx(),
    });
    executor.register(commands.trim, {
        handler: (input) => getEngine().trim(input.id, input.start, input.end),
    });
    executor.register(commands.set_sfx_play_mode, {
        handler: (input) => getEngine().set_sfx_play_mode(input.id, input.mode),
    });
    executor.register(commands.discard_sound, {
        handler: (input) => getEngine().discard_sound(input.id),
    });
    executor.register(commands.create_group, {
        handler: (input) => getEngine().createChannel(input.name),
    });
    executor.register(commands.delete_group, {
        handler: (input) => getEngine().delete_group(input.name),
    });
    executor.register(commands.rename_group, {
        handler: (input) =>
            getEngine().rename_group(input.oldName, input.newName),
    });
    executor.register(commands.move_sound_to_group, {
        handler: (input) =>
            getEngine().move_channel_to_group(input.id, input.newGroup),
    });
    executor.register(commands.move_sound, {
        handler: (input) => getEngine().move_sound(input.id, input.toIndex),
    });
    executor.register(commands.rename, {
        handler: (input) => getEngine().rename(input.id, input.name),
    });
    executor.register(commands.set_gain, {
        handler: (input) => getEngine().set_gain(input.id, input.gain),
    });
    executor.register(commands.ducking, {
        handler: () => getEngine().ducking(),
    });
    executor.register(commands.load_bgm, {
        handler: (input) => getEngine().load_bgm(input.id, input.file),
    });
    executor.register(commands.play_bgm, {
        handler: (input) => getEngine().play_bgm(input.id),
    });
    executor.register(commands.pause_bgm, {
        handler: (input) => getEngine().pause_bgm(input.id),
    });
    executor.register(commands.stop_bgm, {
        handler: (input) => getEngine().stop_bgm(input.id),
    });
    executor.register(commands.seek_bgm, {
        handler: (input) => getEngine().seek_bgm(input.id, input.time),
    });
    executor.register(commands.unload_bgm, {
        handler: (input) => getEngine().unload_bgm(input.id),
    });
    executor.register(commands.load_bgm_to_deck, {
        handler: (input) =>
            getEngine().load_bgm_to_deck(input.id, input.bgmId),
    });
    executor.register(commands.loop_bgm, {
        handler: (input) => getEngine().loop_bgm(input.id),
    });
    executor.register(commands.get_sfx_library, {
        handler: () => getEngine().get_sfx_library(),
    });
    executor.register(commands.get_bgm_library, {
        handler: () => getEngine().get_bgm_library(),
    });
    executor.register(commands.get_group_names, {
        handler: () => getEngine().get_group_names(),
    });
    executor.register(commands.get_all_channels, {
        handler: () => getEngine().get_all_channels(),
    });
};
export { commands as EngineCommands };
