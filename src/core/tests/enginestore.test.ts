import { describe, test, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { EngineEvent } from "../types/types";
import { SoundFileType, type SoundMeta } from "../audioEngine/sounds";
import { UNGROUPED } from "../constants";

class FakeProjectManager extends EventTarget {
    sfxLibrary: Record<string, SoundMeta> = {};
    bgmLibrary: Record<string, SoundMeta> = {};
    groupNames: string[] = [];

    get_sfx_library() {
        return this.sfxLibrary;
    }
    get_bgm_library() {
        return this.bgmLibrary;
    }
    get_group_names() {
        return [...this.groupNames, UNGROUPED];
    }
    get_sidecar_mode() {
        return undefined;
    }
    get_bgm_info() {
        return { playing: false, meta: null, current_time: 0, duration: 0 };
    }
}

const fakeManager = new FakeProjectManager();

vi.mock("../index", () => ({ ProjectManager: fakeManager }));

const sound = (id: string): SoundMeta => ({
    id,
    filename: `${id}.wav`,
    type: SoundFileType.SFX,
});

describe("useEngineState - library sync", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        fakeManager.sfxLibrary = {};
        fakeManager.bgmLibrary = {};
        fakeManager.groupNames = [];
    });

    test("groupNames stays empty (only UNGROUPED) before any sync event fires", async () => {
        const { useEngineState } = await import("../store/enginestore");
        const store = useEngineState();
        expect(store.groupNames).toEqual([]);
    });

    test("Initialised populates groupNames from the engine, not just sfx/bgm libraries", async () => {
        const { useEngineState } = await import("../store/enginestore");
        const store = useEngineState();

        fakeManager.groupNames = ["SFX"];
        fakeManager.sfxLibrary = { a: sound("a") };
        fakeManager.dispatchEvent(new Event(EngineEvent.Initialised));

        expect(store.groupNames).toEqual(["SFX", UNGROUPED]);
        expect(store.sfx_library).toEqual([sound("a")]);
    });

    test("ChangedLibrary populates groupNames the same way Initialised does", async () => {
        const { useEngineState } = await import("../store/enginestore");
        const store = useEngineState();

        fakeManager.groupNames = ["SFX", "アンビエンス"];
        fakeManager.dispatchEvent(new Event(EngineEvent.ChangedLibrary));

        expect(store.groupNames).toEqual(["SFX", "アンビエンス", UNGROUPED]);
    });

    test("a later ChangedLibrary still reflects newly created groups after Initialised ran with none", async () => {
        const { useEngineState } = await import("../store/enginestore");
        const store = useEngineState();

        fakeManager.groupNames = ["SFX"];
        fakeManager.dispatchEvent(new Event(EngineEvent.Initialised));
        expect(store.groupNames).toEqual(["SFX", UNGROUPED]);

        fakeManager.groupNames = ["SFX", "BGM"];
        fakeManager.dispatchEvent(new Event(EngineEvent.ChangedLibrary));
        expect(store.groupNames).toEqual(["SFX", "BGM", UNGROUPED]);
    });
});
