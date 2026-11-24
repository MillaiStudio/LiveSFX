import { defineStore } from "pinia";
import { ref } from "vue";
import { SFXPlayMode } from "../audioEngine/sounds";

export const useConfigStore = defineStore("config", () => {
    const is_first = ref(true);

    const enterEditModeConfirm = ref(true);
    const alertBeforeLeave = ref(true);
    const modalAnimation = ref(true);
    const maxLogEntries = ref(2000);
    const defaultPlayMode = ref(SFXPlayMode.OverLap);
    const maxPoly = ref(30);

    // フェーダー関連 (components/Channel.vue のdB<->位置変換で使用)
    const faderCurve = ref(3);
    const faderMaxDb = ref(10);
    const faderMinDb = ref(-60);
    const faderUnityPosition = ref(0.25);

    // サウンドカードの並び替え関連 (components/Sounds.vue で使用)
    const dragThreshold = ref(8);
    const swapInnerRatio = ref(1);
    const swapCooldownMs = ref(160);

    const memoryLastTab = ref(false);

    const collecting_error_info_consent = ref(false);

    const ducking_amount = ref(-12);

    const autoSelectCredentials = ref(true);
    const beforeEnterVisitorAlert = ref(true);

    return {
        is_first,
        enterEditModeConfirm,
        alertBeforeLeave,
        modalAnimation,
        maxLogEntries,
        defaultPlayMode,
        maxPoly,
        faderCurve,
        faderMaxDb,
        faderMinDb,
        faderUnityPosition,
        dragThreshold,
        swapInnerRatio,
        swapCooldownMs,
        memoryLastTab,
        collecting_error_info_consent,
        ducking_amount,
        autoSelectCredentials,
        beforeEnterVisitorAlert,
    };
});
