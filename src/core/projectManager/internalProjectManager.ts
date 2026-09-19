import { AudioEngine, PlayerEvent } from "../audioEngine/audioengine";
import { LogCategory, logger } from "../log/log";
import { useConfigStore } from "../store/configstore";
import { EngineProcState } from "../store/enginestore_type";
import { EngineError, EngineException } from "../types/error_types";
import { EngineEvent } from "../types/types";
import { check_audio_compatibility } from "../util/compatibility";
import projectStateManager from "./projectStateManager";
import projectStorageManager from "./projectStorageManager";
export const log = logger.module("internalProjectManager");

export class InternalProjectManager extends EventTarget {
    protected projectname: string;

    protected engine: AudioEngine;
    protected storageManager: projectStorageManager;
    protected stateManager: projectStateManager;
    constructor() {
        super();

        this.projectname = "名称未設定";
        this.storageManager = new projectStorageManager();
        this.stateManager = new projectStateManager(this, {
            onChangedHandler: () => {
                this.render_title();
            },
            onSavedHandler: () => {
                this.render_title();
            },
        });
        this.engine = new AudioEngine();
        window.addEventListener("beforeunload", (e) => {
            log.info(LogCategory.SYSTEM, "Unload", "Page unload requested");
            const store = useConfigStore();
            if (this.stateManager.is_dirty() && store.alertBeforeLeave) {
                log.info(
                    LogCategory.SYSTEM,
                    "PreventUnload",
                    "Unload confirmation requested",
                );
                e.preventDefault();
            }
        });
    }
    protected error(type: EngineError | EngineException | string) {
        log.error(LogCategory.SYSTEM, "Error", "Chaught an error", {
            data: { type },
        });
        this.dispatchEvent(
            new CustomEvent(EngineEvent.Error, {
                detail: {
                    type: type,
                },
            }),
        );
    }
    protected warn(type: EngineError) {
        log.warn(LogCategory.SYSTEM, "Warn", "Warning", {
            data: { type },
        });
        this.dispatchEvent(
            new CustomEvent(EngineEvent.Warn, {
                detail: {
                    type: type,
                },
            }),
        );
    }
    protected render_title(prjname?: string) {
        log.info(LogCategory.SYSTEM, "TitleRender", `Rendering title`, {
            data: {
                before: document.title,
                after:
                    (this.stateManager.is_dirty() ? "* " : "") +
                    this.projectname +
                    " - LiveSFX",
            },
        });
        if (prjname) this.projectname = prjname;
        if (this.projectname == "名称未設定") {
            document.title = "LiveSFX";
            return;
        }
        document.title =
            (this.stateManager.is_dirty() ? "* " : "") +
            this.projectname +
            " - LiveSFX";
    }
    async init(filename?: string, from_constructor?: boolean) {
        log.info(
            LogCategory.SYSTEM,
            "Initialise",
            "Initialising InternalProjectManager",
            {
                data: {
                    appVer: __APP_VERSION__,
                },
            },
        );
        if (this.engine && !from_constructor) {
            log.info(
                LogCategory.SYSTEM,
                "EngineReplace",
                "Replacing Audio Engine",
            );
            await this.engine.dispose();
            this.engine = new AudioEngine();
            log.info(
                LogCategory.SYSTEM,
                "EngineReplace",
                "Successed to replace audioengine",
            );
        }
        const result = this.storageManager.initialise_storage().then((r) => {
            if (!r.ok) this.warn(EngineError.CouldNotCleanUpDB);
        });
        this.bindAudioEngineEvents();
        this.projectname = filename ?? "名称未設定";
        this.render_title(this.projectname);
        this.engine.createChannel("SFX");
        this.stateManager.init();
        check_audio_compatibility();
        this.dispatchEvent(new Event(EngineEvent.Initialised));
        this.stateManager.markAsSaved();
        log.info(
            LogCategory.SYSTEM,
            "Initialised",
            "Success to init InternalProjectManager",
        );
        await result;
    }
    protected proc_event(state: EngineProcState) {
        log.info(LogCategory.EVENT, "Proccess", state);
        this.dispatchEvent(
            new CustomEvent(EngineEvent.Proccessing, {
                detail: { type: state },
            }),
        );
    }
    protected fin_proc() {
        log.info(LogCategory.EVENT, "Proccess End", "Proccess has finished");
        this.dispatchEvent(new Event(EngineEvent.FinProc));
    }
    private bindAudioEngineEvents() {
        for (const event of Object.values(PlayerEvent)) {
            log.debug(
                LogCategory.SYSTEM,
                "SetListeiner",
                `Setting Listener to audioengine`,
                { data: { target: event } },
            );
            this.engine.addEventListener(event, (e) => {
                this.dispatchEvent(
                    new CustomEvent(event, {
                        detail: (e as CustomEvent).detail,
                    }),
                );
            });
        }
    }
}
