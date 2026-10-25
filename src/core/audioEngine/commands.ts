import { defineCommand as d } from "../api/commands";
import type { CommandProc, Executor } from "../api/executor";
import type { AudioEngineError } from "../types/err";
import type { Result } from "../types/types";
import type { AudioEngine, PlayResult } from "./audioengine";

type playType = {
    input: {
        id: string;
        options?: {
            start?: number;
            end?: number;
        };
    };
    output: Promise<Result<PlayResult, AudioEngineError>>;
};

const commands = {
    play: d<playType["input"], playType["output"]>("engine.play"),
    stop: d<{ source_id: string }, void>("engine.stop"),
    stop_all_sfx: d<void, void>("engine.stop_all_sfx"),
};

const createAudioEngineCommandImpl = (engine: AudioEngine) => {
    const procs: Record<string, CommandProc<any, any>> = {
        "engine.play": {
            hanlder: (args: {
                id: string;
                options?: { start?: number; end?: number };
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
