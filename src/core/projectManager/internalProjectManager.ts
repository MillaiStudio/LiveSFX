import { AudioEngine, PlayerEvent } from "../audioEngine/audioengine";
import { useConfigStore } from "../store/configstore";
import { EngineProcState } from "../store/enginestore_type";
import { EngineError, EngineException } from "../types/error_types";
import { EngineEvent } from "../types/types";
import { check_audio_compatibility } from "../util/compatibility";
import projectStateManager from "./projectStateManager";
import projectStorageManager from "./projectStorageManager";

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
            const store = useConfigStore();
            if (this.stateManager.is_dirty() && store.alertBeforeLeave) {
                e.preventDefault();
            }
        });
    }
    protected error(type: EngineError | EngineException | string) {
        this.dispatchEvent(
            new CustomEvent(EngineEvent.Error, {
                detail: {
                    type: type,
                },
            }),
        );
    }
    protected warn(type: EngineError) {
        this.dispatchEvent(
            new CustomEvent(EngineEvent.Warn, {
                detail: {
                    type: type,
                },
            }),
        );
    }
    protected render_title(prjname?: string) {
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
        if (this.engine && !from_constructor) {
            await this.engine.dispose();
            this.engine = new AudioEngine();
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
        await result;
    }
    protected proc_event(state: EngineProcState) {
        this.dispatchEvent(
            new CustomEvent(EngineEvent.Proccessing, {
                detail: { type: state },
            }),
        );
    }
    protected fin_proc() {
        this.dispatchEvent(new Event(EngineEvent.FinProc));
    }
    private bindAudioEngineEvents() {
        for (const event of Object.values(PlayerEvent)) {
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
