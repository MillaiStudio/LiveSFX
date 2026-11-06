import { ProjectManager } from "..";
import type { Executor } from "../api/executor";
import type { AudioEngine } from "../audioEngine/audioengine";
import { EngineCommands } from "../audioEngine/commands";
import { useEngineState } from "../store/enginestore";
import type { EngineEvent } from "../types/types";
import {
    SideCar,
    SideCarCommand,
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
    excec(payload: SideCarCommandPayload) {
        switch (payload.cmd) {
            case SideCarCommand.Play:
                return this.executor.run(EngineCommands.play, {
                    id: payload.id,
                    options: payload.options,
                });
            case SideCarCommand.Stop:
                return this.executor.run(EngineCommands.stop, {
                    source_id: payload.source_id,
                });
            case SideCarCommand.StopAllSfx:
                return this.executor.run(EngineCommands.stop_all_sfx);
            case SideCarCommand.Ducking:
                return this.executor.run(EngineCommands.ducking);
            case SideCarCommand.SetGain:
                return this.executor.run(EngineCommands.set_gain, {
                    id: payload.id,
                    gain: payload.gain,
                    initialised: payload.initialising,
                });
            case SideCarCommand.PlayBgm:
                return this.executor.run(EngineCommands.play_bgm, {
                    id: payload.deck,
                });
            case SideCarCommand.PauseBgm:
                return this.executor.run(EngineCommands.pause_bgm, {
                    id: payload.deck,
                });
            case SideCarCommand.StopBgm:
                return this.executor.run(EngineCommands.stop_bgm, {
                    id: payload.deck,
                });
            case SideCarCommand.SeekBgm:
                return this.executor.run(EngineCommands.seek_bgm, {
                    id: payload.deck,
                    time: payload.time,
                });
            case SideCarCommand.LoadBgmToDeck:
                return this.executor.run(EngineCommands.load_bgm_to_deck, {
                    id: payload.deck,
                    bgmId: payload.bgmId,
                });
            case SideCarCommand.UnloadBGM:
                return this.executor.run(EngineCommands.unload_bgm, {
                    id: payload.deck,
                });
            case SideCarCommand.ToggleLoop:
                return this.executor.run(EngineCommands.loop_bgm, {
                    id: payload.id,
                });
        }
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
            sfx_library: this.executor.runSync(EngineCommands.get_sfx_library),
            bgm_library: this.executor.runSync(EngineCommands.get_bgm_library),
            groupNames: this.executor.runSync(EngineCommands.get_group_names),
            channels: this.executor.runSync(EngineCommands.get_all_channels),
        };
    }
    sendSnapShot() {
        const { playing_sfx, deck, ducking } = useEngineState();
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
