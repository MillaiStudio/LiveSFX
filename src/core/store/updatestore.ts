import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { generateUUID } from "../util/util.ts";
import { useNotifState } from "./notif.ts";

export interface VersionInfo {
    version: string;
    date?: string;
    notes: string[];
}

const CURRENT_VERSION = __APP_VERSION__;

export const useUpdateStore = defineStore("update", () => {
    const currentVersion = CURRENT_VERSION;
    const newVersion = ref<VersionInfo | null>(null);
    const showUpdateModal = ref(false);
    const checking = ref(false);

    const hasPendingUpdate = computed(() => newVersion.value !== null);

    let applyFn: (() => void) | null = null;
    let registration: ServiceWorkerRegistration | undefined;

    const setRegistration = (reg: ServiceWorkerRegistration | undefined) => {
        registration = reg;
    };

    const notifyUpdateAvailable = async (apply: () => void) => {
        applyFn = apply;

        let info: VersionInfo = { version: "?", notes: [] };

        try {
            const res = await fetch(`/version.json?_=${Date.now()}`, {
                cache: "no-store",
            });

            if (res.ok) {
                info = (await res.json()) as VersionInfo;
            }
        } catch {}

        newVersion.value = info;

        const notif_store = useNotifState();

        notif_store.notif_queue.push({
            id: generateUUID(),
            type: "info",
            title: "新しいバージョンが利用可能になりました",
            message: `v${currentVersion} → v${info.version}`,
            onClick: () => {
                showUpdateModal.value = true;
            },
        });
    };

    const applyUpdate = () => {
        showUpdateModal.value = false;
        applyFn?.();
    };

    const dismissModal = () => {
        showUpdateModal.value = false;
    };

    const checkForUpdate = async () => {
        if (hasPendingUpdate.value) {
            showUpdateModal.value = true;
            return;
        }

        checking.value = true;

        const notif_store = useNotifState();

        try {
            if (!registration) {
                const id = generateUUID();
                notif_store.notif_queue.push({
                    id,
                    type: "warn",
                    title: "更新の取得に失敗しました",
                    message: "LiveSFXの更新を取得できませんでした",
                });
                setTimeout(() => {
                    notif_store.dismissNotif(id);
                }, 3000);
                return;
            }
            await registration.update();

            const found = !!(registration.installing || registration.waiting);

            if (!found) {
                const id = generateUUID();

                notif_store.notif_queue.push({
                    id,
                    type: "info",
                    title: "最新の状態です",
                });

                setTimeout(() => notif_store.dismissNotif(id), 3000);
            }
        } finally {
            checking.value = false;
        }
    };

    return {
        currentVersion,
        newVersion,
        showUpdateModal,
        hasPendingUpdate,
        checking,
        setRegistration,
        notifyUpdateAvailable,
        applyUpdate,
        dismissModal,
        checkForUpdate,
    };
});
