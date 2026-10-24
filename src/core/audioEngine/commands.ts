import { defineCommand as d } from "../api/commands";
import type { AudioEngineError } from "../types/err";
import type { Result } from "../types/types";
import type { PlayResult } from "./audioengine";

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
