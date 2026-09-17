import { EngineEvent } from "../types/types";
import type { InternalProjectManager } from "./internalProjectManager";
import { useConfigStore } from "../store/configstore";

interface stateManagerHandler {
    onChangedHandler?: Function;
    onSavedHandler?: Function;
}

export default class {
    private dirty: boolean;
    private handler: stateManagerHandler;
    private self: InternalProjectManager;

    constructor(self: InternalProjectManager, handler?: stateManagerHandler) {
        this.self = self;
        this.dirty = false;
        this.handler = handler ?? {};
    }
    init() {
        this.dirty = false;
    }
    markAsChanged() {
        this.dirty = true;
        const handler = this.handler.onChangedHandler;
        this.self.dispatchEvent(new CustomEvent(EngineEvent.ChangedLibrary));
        if (handler) handler();
    }
    markAsSaved() {
        this.dirty = false;
        const handler = this.handler.onSavedHandler;
        this.self.dispatchEvent(new Event(EngineEvent.SavedLibrary));
        if (handler) handler();
    }
    is_dirty() {
        return this.dirty;
    }
    leaveConfirm(): boolean {
        const config = useConfigStore();
        if (this.dirty && config.alertBeforeLeave) {
            const will = confirm(
                "未保存の変更があります。終了してもよろしいですか？",
            );
            if (!will) return false;
        }
        return true;
    }
}
