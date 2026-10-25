import { defineCommand as d } from "../api/commands";
import type { CommandProc, Executor } from "../api/executor";
import type { ProjectManager } from "../projectManager/projectmanager";
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

export const commands = [
    d<playType["input"], playType["output"]>("engine.play"),
    d<{ source_id: string }, void>("engine.stop"),
    d<void, void>("engine.stop_all_sfx"),
];

const createAudioEngineCommandImpl = (engine: AudioEngine) => {
    const procs: Record<string, CommandProc<any, any>> = {
        "engine.play": {
            hanlder: (
                id: string,
                options?: { start?: number; end?: number },
            ) => {
                return engine.play(id, options);
            },
        },
        "engine.stop": {
            hanlder: (source_id: string) => {
                return engine.stop(source_id);
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

const SetAudioEngineCommands = (executor: Executor, engine: AudioEngine) => {
    const propc = createAudioEngineCommandImpl(engine);
    for (let command of commands) {
        executor.register(command, propc[command.name]!);
    }
};
