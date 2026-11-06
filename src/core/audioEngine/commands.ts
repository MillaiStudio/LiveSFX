import { defineCommand as d } from "../api/commands";
import type { CommandProc, Executor } from "../api/executor";
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

const createAudioEngineCommandImpl = (engine: AudioEngine) => {
    const procs: Record<string, CommandProc<any, any>> = {
        "engine.play": {
            hanlder: (args: {
                id: string;
                options?: {
                    start?: number;
                    end?: number;
                    beforestart?: (id: string) => void;
                    onended?: (id: string) => void;
                };
            }) => {
                return engine.play(args.id, args.options);
            },
        },
        "engine.stop": {
            hanlder: (args: { source_id: string }) => {
                return engine.stop(args.source_id);
            },
        },
        "engine.stop_all_sfx": {
            hanlder: () => {
                return engine.stop_all_sfx();
            },
        },
        "engine.trim": {
            hanlder: (args: { id: string; start: number; end: number }) => {
                return engine.trim(args.id, args.start, args.end);
            },
        },
        "engine.set_sfx_play_mode": {
            hanlder: (args: { id: string; mode: SFXPlayMode }) => {
                return engine.set_sfx_play_mode(args.id, args.mode);
            },
        },
        "engine.discard_sound": {
            hanlder: (args: { id: string }) => {
                return engine.discard_sound(args.id);
            },
        },
        "engine.create_group": {
            hanlder: (args: { name: string }) => {
                return engine.createChannel(args.name);
            },
        },
        "engine.delete_group": {
            hanlder: (args: { name: string }) => {
                return engine.delete_group(args.name);
            },
        },
        "engine.rename_group": {
            hanlder: (args: { oldName: string; newName: string }) => {
                return engine.rename_group(args.oldName, args.newName);
            },
        },
        "engine.move_sound_to_group": {
            hanlder: (args: { id: string; newGroup?: string }) => {
                return engine.move_channel_to_group(args.id, args.newGroup);
            },
        },
        "engine.move_sound": {
            hanlder: (args: { id: string; toIndex: number }) => {
                return engine.move_sound(args.id, args.toIndex);
            },
        },
        "engine.rename": {
            hanlder: (args: { id: string; name: string }) => {
                return engine.rename(args.id, args.name);
            },
        },
        "engine.set_gain": {
            hanlder: (args: {
                id: string;
                gain: number;
                initialised?: boolean;
            }) => {
                return engine.set_gain(args.id, args.gain);
            },
        },
        "engine.ducking": {
            hanlder: () => {
                return engine.ducking();
            },
        },
        "engine.load_bgm": {
            hanlder: (args: { id: DeckID; file: BGMFile }) => {
                return engine.load_bgm(args.id, args.file);
            },
        },
        "engine.play_bgm": {
            hanlder: (args: { id: DeckID }) => {
                return engine.play_bgm(args.id);
            },
        },
        "engine.pause_bgm": {
            hanlder: (args: { id: DeckID }) => {
                return engine.pause_bgm(args.id);
            },
        },
        "engine.stop_bgm": {
            hanlder: (args: { id: DeckID }) => {
                return engine.stop_bgm(args.id);
            },
        },
        "engine.seek_bgm": {
            hanlder: (args: { id: DeckID; time: number }) => {
                return engine.seek_bgm(args.id, args.time);
            },
        },
        "engine.unload_bgm": {
            hanlder: (args: { id: DeckID }) => {
                return engine.unload_bgm(args.id);
            },
        },
        "engine.load_bgm_to_deck": {
            hanlder: (args: { id: DeckID; bgmId: string }) => {
                return engine.load_bgm_to_deck(args.id, args.bgmId);
            },
        },
        "engine.loop_bgm": {
            hanlder: (args: { id: DeckID }) => {
                return engine.loop_bgm(args.id);
            },
        },
        "engine.get_sfx_library": {
            hanlder: () => engine.get_sfx_library(),
        },
        "engine.get_bgm_library": {
            hanlder: () => engine.get_bgm_library(),
        },
        "engine.get_group_names": {
            hanlder: () => engine.get_group_names(),
        },
        "engine.get_all_channels": {
            hanlder: () => engine.get_all_channels(),
        },
    };
    return procs;
};

export const SetAudioEngineCommands = (
    executor: Executor,
    engine: AudioEngine,
) => {
    const propc = createAudioEngineCommandImpl(engine);
    for (let command of Object.values(commands)) {
        executor.register(command, propc[command.name]!);
    }
};
export { commands as EngineCommands };
