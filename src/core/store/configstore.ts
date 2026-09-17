import { defineStore } from "pinia";
import { SFXPlayMode } from "../audioEngine/sounds";

export const useConfigStore = defineStore("config", {
    state: () => ({
        is_first: true,

        enterEditModeConfirm: true,
        alertBeforeLeave: true,
        modalAnimation: true,
        maxLogEntries: 2000,
        defaultPlayMode: SFXPlayMode.OverLap,
        maxPoly: 30,

        // フェーダー関連 (components/Channel.vue のdB<->位置変換で使用)
        faderCurve: 3,
        faderMaxDb: 10,
        faderMinDb: -60,
        faderUnityPosition: 0.25,

        // サウンドカードの並び替え関連 (components/Sounds.vue で使用)
        dragThreshold: 8,
        swapInnerRatio: 1,
        swapCooldownMs: 160,

        memoryLastTab: false,

        collecting_error_info_consent: false,

        ducking_amount: -12,

        autoSelectCredentials: true,
        beforeEnterVisitorAlert: true,
    }),
});
