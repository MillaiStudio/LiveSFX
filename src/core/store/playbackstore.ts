import { defineStore } from "pinia";
import { ref } from "vue";
import { ProjectManager } from "..";
import { type SoundMeta } from "../audioEngine/sounds";
import { EngineEvent } from "../types/types";
import { PlayerEvent, type DeckID } from "../audioEngine/audioengine";

export interface BGMPlayerInfo {
    playing: boolean;
    meta: SoundMeta | null;
    current_time: number;
    duration: number;
    loop?: boolean;
}

export const usePlaybackState = defineStore("playback", () => {
    const ducking = ref<boolean>(false);
    const playing_sfx = ref<string[]>([]);

    const deck = ref<[BGMPlayerInfo, BGMPlayerInfo]>([
        { playing: false, meta: null, current_time: 0, duration: 0 },
        { playing: false, meta: null, current_time: 0, duration: 0 },
    ]);

    ProjectManager.addEventListener(EngineEvent.PlaySFX, ((
        e: CustomEvent<{ id: string }>,
    ) => {
        playing_sfx.value.push(e.detail.id);
    }) as EventListener);
    ProjectManager.addEventListener(EngineEvent.StopSFX, ((
        e: CustomEvent<{ id: string }>,
    ) => {
        const index = playing_sfx.value.indexOf(e.detail.id);
        if (index !== -1) {
            playing_sfx.value.splice(index, 1);
        }
    }) as EventListener);

    ProjectManager.addEventListener(EngineEvent.DuckingActivated, () => {
        ducking.value = true;
    });
    ProjectManager.addEventListener(
        EngineEvent.DuckingDeactivated,
        () => (ducking.value = false),
    );

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
        deck,
        playing_sfx,
        ducking,
    };
});
