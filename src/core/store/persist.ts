import type { PiniaPluginContext } from "pinia";
import { generateUUID } from "../util/util";
import { useNotifState } from "./notif";

const STORAGE_KEY_PREFIX = "livesfx:pref:";
const SAVE_DEBOUNCE_MS = 300;

export const createPersistPlugin =
    (persistedStoreIds: string[]) =>
    ({ store }: PiniaPluginContext) => {
        if (!persistedStoreIds.includes(store.$id)) return;

        const storageKey = STORAGE_KEY_PREFIX + store.$id;

        restore(store, storageKey);

        let saveTimer: ReturnType<typeof setTimeout> | undefined;

        store.$subscribe(
            (_mutation, state) => {
                clearTimeout(saveTimer);

                saveTimer = setTimeout(
                    () => persist(store.$id, storageKey, state),
                    SAVE_DEBOUNCE_MS,
                );
            },
            { detached: true },
        );
    };

const restore = (store: PiniaPluginContext["store"], storageKey: string) => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;

    try {
        const saved = JSON.parse(raw) as Record<string, unknown>;
        const current = store.$state as Record<string, unknown>;

        const patch: Record<string, unknown> = {};

        for (const key of Object.keys(current)) {
            if (!(key in saved)) continue;
            if (typeof saved[key] !== typeof current[key]) continue;
            patch[key] = saved[key];
        }

        if (Object.keys(patch).length) {
            store.$patch((state) => Object.assign(state, patch));
        }
    } catch (e) {}
};

const persist = (storeId: string, storageKey: string, state: unknown) => {
    try {
        localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (e) {
        const store = useNotifState();
        store.notify({
            id: generateUUID(),
            type: "warn",
            message: `[persist] ${storeId} の設定の保存に失敗しました`,
        });
    }
};
