import { defineStore } from "pinia";
import { ref } from "vue";
import { ProjectManager } from "..";
import { type SoundMeta } from "../audioEngine/sounds";
import { EngineEvent } from "../types/types";
import { EngineProcState } from "./enginestore_type";
import { EngineError, EngineException } from "../types/error_types";
import { generateUUID } from "../util/util";
import { PlayerEvent, type DeckID } from "../audioEngine/audioengine";
import { UNGROUPED } from "../constants";
import { AudioMixerError } from "../types/err";

export interface BGMPlayerInfo {
    playing: boolean;
    meta: SoundMeta | null;
    current_time: number;
    duration: number;
    loop?: boolean;
}

export const useEngineState = defineStore("engine", () => {
    const ducking = ref<boolean>(false);
    const sfx_library = ref<SoundMeta[]>([]);
    const bgm_library = ref<SoundMeta[]>([]);
    const EngineState = ref<EngineProcState>(EngineProcState.Idle);
    const groupNames = ref<string[]>([]);
    const playing_sfx = ref<string[]>([]);
    const sidecar_mode = ref<"host" | "visitor" | undefined>();

    const deck = ref<[BGMPlayerInfo, BGMPlayerInfo]>([
        { playing: false, meta: null, current_time: 0, duration: 0 },
        { playing: false, meta: null, current_time: 0, duration: 0 },
    ]);

    let timer: number | null;

    ProjectManager.addEventListener(EngineEvent.PlaySFX, ((
        e: CustomEvent<{ id: string }>,
    ) => {
        console.log(e.detail);
        playing_sfx.value.push(e.detail.id);
        console.log(playing_sfx.value);
    }) as EventListener);
    ProjectManager.addEventListener(EngineEvent.StopSFX, ((
        e: CustomEvent<{ id: string }>,
    ) => {
        const index = playing_sfx.value.indexOf(e.detail.id);
        if (index !== -1) {
            playing_sfx.value.splice(index, 1);
        }
    }) as EventListener);

    ProjectManager.addEventListener(EngineEvent.SideCarStarted, () => {
        sidecar_mode.value = ProjectManager.get_sidecar_mode();
    });
    ProjectManager.addEventListener(EngineEvent.SideCarEnded, () => {
        sidecar_mode.value =
            ProjectManager.sidecar.connections.size > 0
                ? sidecar_mode.value
                : undefined;
    });
    const syncLibraryFromEngine = () => {
        const sounds: Record<string, SoundMeta> =
            ProjectManager.get_sfx_library();
        const musics: Record<string, SoundMeta> =
            ProjectManager.get_bgm_library();
        sfx_library.value = Object.values(sounds);
        bgm_library.value = Object.values(musics);
        groupNames.value = [...ProjectManager.get_group_names()];
    };
    ProjectManager.addEventListener(
        EngineEvent.ChangedLibrary,
        syncLibraryFromEngine,
    );
    ProjectManager.addEventListener(EngineEvent.GainChanged, () => {
        sfx_library.value = Object.values(ProjectManager.get_sfx_library());
    });
    ProjectManager.addEventListener(
        EngineEvent.Initialised,
        syncLibraryFromEngine,
    );
    ProjectManager.addEventListener(EngineEvent.DuckingActivated, () => {
        ducking.value = true;
    });
    ProjectManager.addEventListener(
        EngineEvent.DuckingDeactivated,
        () => (ducking.value = false),
    );
    ProjectManager.addEventListener(EngineEvent.Proccessing, (e) => {
        const event = e as CustomEvent<{ type: EngineProcState }>;
        EngineState.value = event.detail.type;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            if (EngineState.value !== EngineProcState.Idle) {
                EngineState.value = EngineProcState.SomeTakesTooLong;
            }
        }, 1000);
    });

    ProjectManager.addEventListener(EngineEvent.FinProc, () => {
        if (timer) clearTimeout(timer);
        EngineState.value = EngineProcState.Idle;
    });

    const deckIndex = (id: DeckID) => (id === "deckA" ? 0 : 1);

    for (const event of Object.values(PlayerEvent)) {
        ProjectManager.addEventListener(event, (e) => {
            const detail = (e as CustomEvent<{ deck?: "deckA" | "deckB" }>)
                .detail;
            const id = detail?.deck;
            if (!id) return;
            const info = ProjectManager.get_bgm_info(id);
            deck.value[deckIndex(id)] = info;
        });
    }
    return {
        sfx_library,
        bgm_library,
        EngineState,
        deck,
        groupNames,
        playing_sfx,
        ducking,
        sidecar_mode,
    };
});
