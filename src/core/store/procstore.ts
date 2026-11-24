import { defineStore } from "pinia";
import { ref } from "vue";
import { ProjectManager } from "..";
import { EngineEvent } from "../types/types";

export const EngineProcState = {
    Idle: "idle",
    Loading: "loading",
    Writing: "writing",
    Proccessing: "proc",
    SomeTakesTooLong: "too_long",
} as const;

export type EngineProcState =
    (typeof EngineProcState)[keyof typeof EngineProcState];

export const useProcState = defineStore("proc", () => {
    const EngineState = ref<EngineProcState>(EngineProcState.Idle);

    let timer: number | null;

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

    return {
        EngineState,
    };
});
