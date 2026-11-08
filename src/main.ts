import { createApp } from "vue";
import { createPinia, type Pinia } from "pinia";
import App from "./App.vue";
import "./style/main.css";
import { ProjectManager } from "./core/index.ts";
import { registerSW } from "virtual:pwa-register";
import { createPersistPlugin } from "./core/store/persist.ts";
import { useUpdateStore } from "./core/store/updatestore.ts";
import { setZXingModuleOverrides } from "vue-qrcode-reader";
import { generateUUID, onPanic, showFatalOverlay } from "./core/util/util.ts";
import { useNotifState } from "./core/store/notif.ts";
import { useLog } from "./core/store/logstore.ts";

let pinia: Pinia | null = null;
let pendingRegistration: ServiceWorkerRegistration | undefined;

//https://github.com/Sec-ant/barcode-detector/issues/18
setZXingModuleOverrides({
    locateFile: (path, prefix) => {
        if (path.endsWith(".wasm")) {
            return "/zxing_reader.wasm";
        }
        return prefix + path;
    },
});

pinia = createPinia();
const app = createApp(App);
app.use(pinia);
pinia.use(createPersistPlugin(["config", "ui_state"]));
app.config.errorHandler = (err) => {
    onPanic(err);
};

try {
    await ProjectManager.init(undefined, true);
} catch (e) {
    showFatalOverlay(e);
    throw e;
}

app.mount("#app");
useLog();
if (import.meta.env.MODE == "bin") {
    window.addEventListener("beforeunload", () => {
        fetch("/shutdown", { method: "POST" });
    });
}

const updateSW = registerSW({
    onNeedRefresh() {
        if (!pinia) return;
        useUpdateStore(pinia).notifyUpdateAvailable(() => updateSW(true));
    },
    onRegisteredSW(_swUrl, registration) {
        pendingRegistration = registration;
        if (!pinia) return;
        useUpdateStore(pinia).setRegistration(registration);
    },
    onOfflineReady() {
        const store = useNotifState();
        const id = generateUUID();
        const timer = setTimeout(() => store.dismissNotif(id), 2000);
        store.notify({
            id,
            title: "ダウンロード済み",
            message: "LiveSFXはオフラインで使用可能です。",
            type: "info",
            onClick: () => clearTimeout(timer),
        });
    },
});
