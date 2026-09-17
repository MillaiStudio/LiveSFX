import { type SoundMeta } from "../audioEngine/sounds";
import type { LVSFSoundFileMeta } from "../files/fileUtil";

export enum EngineEvent {
    ChangedLibrary = "changed_library",
    SavedLibrary = "saved_library",
    NewSound = "new_sound",
    Initialised = "initialised",
    Warn = "warning",
    LoadedPrj = "loaded_project",
    Proccessing = "proccessing",
    FinProc = "proc_end",
    Error = "error",
    PlaySFX = "playsfx",
    StopSFX = "endsfx",
    DuckingActivated = "duckingactivated",
    DuckingDeactivated = "duckingdeactivated",
    SideCarStarted = "sidecarstarted",
    SideCarEnded = "sidecarended",
    CrossFaded = "crossfaded",
    SideCarUpdated = "updatedsidecar",
    GainChanged = "gainchanged",
}

export interface lvsf_prj_internal_meta extends lvsf_prj_info {
    files: LVSFSoundFileMeta[];
}

export interface lvsf_prj_info {
    filename: string;
    sounds: SoundMeta[];
}

export type Ok<T = void> = [T] extends [void]
    ? { ok: true }
    : { ok: true; value: T };

export type Err<E> = { ok: false; value: E };

export type Result<T, E = Error> = Ok<T> | Err<E>;

export function Ok(): Ok<void>;
export function Ok<T>(value: T): Ok<T>;
export function Ok<T>(value?: T) {
    if (value === undefined) {
        return { ok: true };
    }

    return { ok: true, value };
}

export const Err = <E>(message: E): Err<E> => {
    return { ok: false, value: message };
};
export type None = { some: false };
export type Some<T> = { some: true; value: T };

export type Option<T> = Some<T> | None;

export const Some = <T>(value: T): Option<T> => ({
    some: true,
    value,
});

export const None = (): Option<never> => ({
    some: false,
});

export const isSome = <T>(option: Option<T>) => {
    const some = option.some;
    return some;
};
