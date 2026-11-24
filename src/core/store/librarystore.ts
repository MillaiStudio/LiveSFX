import { defineStore } from "pinia";
import { ref } from "vue";
import { ProjectManager } from "..";
import { type SoundMeta } from "../audioEngine/sounds";
import { EngineEvent } from "../types/types";

export const useLibraryState = defineStore("library", () => {
    const sfx_library = ref<SoundMeta[]>([]);
    const bgm_library = ref<SoundMeta[]>([]);
    const groupNames = ref<string[]>([]);

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

    return {
        sfx_library,
        bgm_library,
        groupNames,
    };
});
