import { type AudioEngine } from "../audioEngine/audioengine";
import projectStateManager from "../projectManager/projectStateManager";
import { AudioMixerError } from "../types/err";
import type { Result } from "../types/types";

export class UiCommandsManager extends EventTarget {
    engine: AudioEngine;
    stateManager: projectStateManager;
    onError: (e: any) => void;
    constructor(
        engine: AudioEngine,
        statemanager: projectStateManager,
        onERR: (e: any) => void,
    ) {
        super();
        this.engine = engine;
        this.stateManager = statemanager;
        this.onError = onERR;
    }
    replace_engine(new_one: AudioEngine) {
        this.engine = new_one;
    }
    get_sfx_library() {
        return this.engine.get_sfx_library();
    }
    get_bgm_library() {
        return this.engine.get_bgm_library();
    }
    get_duration(id: string) {
        return this.engine.get_duration(id);
    }
    get_waveform(id: string, buckets: number) {
        return this.engine.get_waveform(id, buckets);
    }
    get_soundinfo(id: string) {
        return this.engine.get_soundinfo(id);
    }
    stop_all_sfx() {
        return this.engine.stop_all_sfx();
    }
    get_group_children(parent: string) {
        return this.engine.get_group_children(parent);
    }
    get_group_names(): string[] {
        return this.engine.get_group_names();
    }
    get_all_channels() {
        return this.engine.get_all_channels();
    }
    get_gain(id: string): Result<number, AudioMixerError> {
        return this.engine.get_gain(id);
    }
    get_bgm_info(id: "deckA" | "deckB") {
        return this.engine.get_bgm_info(id);
    }
}
