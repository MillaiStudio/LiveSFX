import { defineStore } from "pinia";
import { ref } from "vue";

export const useUiState = defineStore("ui_state", () => {
    const ui_mode = ref<"live" | "edit">("live");
    const tab = ref<"pad" | "bgm" | "mixer">("pad");

    return {
        ui_mode,
        tab,
    };
});
