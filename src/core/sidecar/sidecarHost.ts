import type { Executor } from "../api/executor";
import type { AudioEngine } from "../audioEngine/audioengine";
import { EngineCommands } from "../audioEngine/commands";
import { usePlaybackState } from "../store/playbackstore";
import type { EngineEvent } from "../types/types";
import { remoteCommandByCmd } from "./remoteCommands";
import {
    SideCar,
    type SideCarCommandPayload,
    type SideCarStateSnapshot,
} from "./sidecar";

export class SideCarHostRelay {
    private executor: Executor;
    private sidecar: SideCar;
    constructor(executor: Executor, sidecar: SideCar) {
        this.executor = executor;
        this.sidecar = sidecar;
    }
    executeRemote(payload: SideCarCommandPayload) {
        return remoteCommandByCmd
            .get(payload.cmd)
            ?.runRemote(this.executor, payload);
    }
    send_event(event: EngineEvent, detail?: unknown) {
        this.sidecar.send({
            kind: "event",
            event,
            detail,
        });
    }
    buildLibraryState() {
        return {
            sfx_library: this.executor.run(EngineCommands.get_sfx_library),
            bgm_library: this.executor.run(EngineCommands.get_bgm_library),
            groupNames: this.executor.run(EngineCommands.get_group_names),
            channels: this.executor.run(EngineCommands.get_all_channels),
        };
    }
    sendSnapShot() {
        const { playing_sfx, deck, ducking } = usePlaybackState();
        const state: SideCarStateSnapshot = {
            ...this.buildLibraryState(),
            playing_sfx,
            deck,
            ducking,
        };
        this.sidecar.send({
            kind: "snapshot",
            state,
        });
    }
}
