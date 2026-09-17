import {
    PlayerEvent,
    type AudioEngine,
    type DeckID,
} from "../audioEngine/audioengine";
import { SFXPlayMode } from "../audioEngine/sounds";
import projectStateManager from "../projectManager/projectStateManager";
import { AudioMixerError } from "../types/err";
import { EngineEvent } from "../types/types";
import type { Result } from "../types/types";
import type { BGMFile } from "../audioEngine/sounds";

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
    private executeEngineAction<T, E>(
        action: () => Result<T, E>,
        markChanged: boolean = true,
    ): Result<T, E> {
        const result = action();
        if (!result.ok) {
            this.onError(result.value);
        } else if (markChanged) {
            this.stateManager.markAsChanged();
        }
        return result;
    }
    replace_engine(new_one: AudioEngine) {
        this.engine = new_one;
    }
    play(id: string, options?: { start?: number; end?: number }) {
        return this.engine.play(id, {
            ...options,
            beforestart: () => {
                this.dispatchEvent(
                    new CustomEvent(EngineEvent.PlaySFX, { detail: { id } }),
                );
            },
            onended: () => {
                this.dispatchEvent(
                    new CustomEvent(EngineEvent.StopSFX, { detail: { id } }),
                );
            },
        });
    }
    stop(source_id: string) {
        const res = this.engine.stop(source_id);
        if (res.ok) {
            this.dispatchEvent(
                new CustomEvent(EngineEvent.StopSFX, {
                    detail: { id: res.value },
                }),
            );
        }
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
    trim(id: string, start: number, end: number) {
        this.engine.trim(id, start, end);
        this.stateManager.markAsChanged();
    }

    set_sfx_playmode(id: string, mode: SFXPlayMode) {
        this.engine.set_sfx_play_mode(id, mode);
        this.stateManager.markAsChanged();
    }

    discard_sound(id: string) {
        this.engine.discard_sound(id);
        this.stateManager.markAsChanged();
    }

    create_group(name: string): Result<string, string> {
        return this.executeEngineAction(() => this.engine.createChannel(name));
    }

    delete_group(name: string): Result<void, string> {
        return this.executeEngineAction(() => this.engine.delete_group(name));
    }

    rename_group(oldName: string, newName: string): Result<void, string> {
        return this.executeEngineAction(() =>
            this.engine.rename_group(oldName, newName),
        );
    }

    move_sound_to_group(id: string, newGroup?: string): Result<void, string> {
        return this.executeEngineAction(() =>
            this.engine.move_channel_to_group(id, newGroup),
        );
    }

    move_sound(id: string, toIndex: number): Result<void, string> {
        return this.executeEngineAction(() =>
            this.engine.move_sound(id, toIndex),
        );
    }

    rename(id: string, name: string) {
        return this.executeEngineAction(() => this.engine.rename(id, name));
    }

    set_gain(
        id: string,
        gain: number,
        initialised?: boolean,
    ): Result<number, AudioMixerError> {
        return this.executeEngineAction(() => {
            const set_Gain_result = this.engine.set_gain(id, gain);
            if (id == "deckA") {
                this.dispatchEvent(new Event(EngineEvent.CrossFaded));
            }
            if (set_Gain_result.ok) {
                this.dispatchEvent(new Event(EngineEvent.GainChanged));
            }
            return set_Gain_result;
        }, !initialised);
    }

    get_gain(id: string): Result<number, AudioMixerError> {
        return this.engine.get_gain(id);
    }

    ducking() {
        const result = this.executeEngineAction(
            () => this.engine.ducking(),
            false,
        );
        if (result.ok) {
            const eventName = result.value
                ? EngineEvent.DuckingActivated
                : EngineEvent.DuckingDeactivated;
            this.dispatchEvent(new Event(eventName));
        }
    }

    get_bgm_info(id: "deckA" | "deckB") {
        return this.engine.get_bgm_info(id);
    }
    load_bgm(id: "deckA" | "deckB", file: BGMFile) {
        this.engine.load_bgm(id, file);
    }
    play_bgm(id: "deckA" | "deckB") {
        return this.engine.play_bgm(id);
    }
    pause_bgm(id: "deckA" | "deckB") {
        this.engine.pause_bgm(id);
    }
    stop_bgm(id: "deckA" | "deckB") {
        this.engine.stop_bgm(id);
    }
    seek_bgm(id: "deckA" | "deckB", time: number) {
        this.engine.seek_bgm(id, time);
    }
    unload_bgm(id: "deckA" | "deckB") {
        this.engine.unload_bgm(id);
    }
    load_bgm_to_deck(id: "deckA" | "deckB", bgmId: string) {
        return this.executeEngineAction(
            () => this.engine.load_bgm_to_deck(id, bgmId),
            false,
        );
    }
    loop_bgm(id: DeckID) {
        return this.engine.loop_bgm(id);
    }
}
