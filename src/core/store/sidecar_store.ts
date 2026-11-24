import { defineStore } from "pinia";
import { ref } from "vue";
import type { Connections } from "../sidecar/sidecar";
import { ProjectManager } from "..";
import { EngineEvent } from "../types/types";
export const useSideCarStore = defineStore("sidecarStore", () => {
    const connections = ref<Omit<Connections, "peer" | "channel">[]>([]);
    const sidecar_mode = ref<"host" | "visitor" | undefined>();

    ProjectManager.addEventListener(EngineEvent.SideCarStarted, () => {
        connections.value = [...ProjectManager.get_connections()];
        sidecar_mode.value = ProjectManager.get_sidecar_mode();
    });
    ProjectManager.addEventListener(EngineEvent.SideCarEnded, () => {
        connections.value = [...ProjectManager.get_connections()];
        sidecar_mode.value =
            ProjectManager.sidecar.connections.size > 0
                ? sidecar_mode.value
                : undefined;
    });
    ProjectManager.addEventListener(EngineEvent.SideCarUpdated, () => {
        connections.value = [...ProjectManager.get_connections()];
    });

    return { connections, sidecar_mode };
});
