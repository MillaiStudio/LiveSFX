import type { SoundMeta } from "../audioEngine/sounds";
import type { MixerChannelSnapshot } from "../audioEngine/mixer";
import { usePlaybackState } from "../store/playbackstore";
import { EngineEvent, Err, Ok, type Result } from "../types/types";
import { AudioMixerError } from "../types/err";
import {
    SideCar,
    type SideCarMessage,
    type SideCarStateSnapshot,
    SideCarEvent,
} from "./sidecar";
import type { BGMPlayerInfo } from "../store/playbackstore";
import { PlayerEvent, type DeckID } from "../audioEngine/audioengine";

type SideCarLibraryState = Pick<
    SideCarStateSnapshot,
    "sfx_library" | "bgm_library" | "groupNames" | "channels"
>;

const emptyBgmInfo = (): BGMPlayerInfo => ({
    playing: false,
    meta: null,
    current_time: 0,
    duration: 0,
});

export class SideCarVisitorRelay {
    private mirror = {
        sfx_library: {} as Record<string, SoundMeta>,
        bgm_library: {} as Record<string, SoundMeta>,
        groupNames: [] as string[],
        channels: [] as MixerChannelSnapshot[],
        deck: [null, null] as [BGMPlayerInfo | null, BGMPlayerInfo | null],
    };
    private sidecar: SideCar;
    private emitLocally: (event: EngineEvent, detail?: unknown) => void;
    constructor(
        sidecar: SideCar,
        emitLocally: (event: EngineEvent, detail?: unknown) => void,
    ) {
        this.sidecar = sidecar;
        this.emitLocally = emitLocally;

        this.sidecar.addEventListener(SideCarEvent.Message, (e) => {
            const msg = (e as CustomEvent<SideCarMessage>).detail;
            if (msg.kind === "snapshot") this.applySnapshot(msg.state);
            if (msg.kind === "event") this.applyEvent(msg.event, msg.detail);
        });

        this.sidecar.addEventListener(SideCarEvent.Disconnect, () =>
            this.resetMirror(),
        );
    }

    private resetMirror() {
        this.mirror = {
            sfx_library: {},
            bgm_library: {},
            groupNames: [],
            channels: [],
            deck: [null, null],
        };
    }

    private applyLibraryState(state: SideCarLibraryState) {
        this.mirror.sfx_library = state.sfx_library;
        this.mirror.bgm_library = state.bgm_library;
        this.mirror.groupNames = state.groupNames;
        this.mirror.channels = state.channels;
    }

    private applySnapshot(state: SideCarStateSnapshot) {
        this.applyLibraryState(state);
        this.mirror.deck = [state.deck[0], state.deck[1]];
        usePlaybackState().$patch({
            playing_sfx: state.playing_sfx,
            deck: state.deck,
            ducking: state.ducking,
        });
        this.emitLocally(EngineEvent.ChangedLibrary);
    }

    private applyEvent(event: EngineEvent, detail: unknown) {
        if (
            event === EngineEvent.ChangedLibrary ||
            event === EngineEvent.Initialised
        ) {
            this.applyLibraryState(detail as SideCarLibraryState);
        }
        if (event == EngineEvent.CrossFaded) {
            const deckA = this.mirror.channels.find((v) => v.id == "deckA");
            if (deckA && detail !== undefined) {
                deckA.gain = detail as number;
            }
        }
        if (Object.values(PlayerEvent).includes(event as PlayerEvent)) {
            const origin = detail as { deck: DeckID; info: BGMPlayerInfo };
            this.mirror.deck[origin.deck === "deckA" ? 0 : 1] = origin.info;
        }
        this.emitLocally(event, detail);
    }

    get_sfx_library() {
        return this.mirror.sfx_library;
    }
    get_bgm_library() {
        return this.mirror.bgm_library;
    }
    get_group_names() {
        return this.mirror.groupNames;
    }
    get_group_children(parent: string): { id: string; name: string }[] {
        return this.mirror.channels
            .filter((c) => !c.isGroup && c.belongs_to === parent)
            .map((c) => ({ id: c.id, name: c.name }));
    }
    get_gain(id: string): Result<number, AudioMixerError> {
        const found = this.mirror.channels.find((c) => c.id === id);
        if (!found) return Err(AudioMixerError.ChannelNotFound);
        return Ok(found.gain);
    }
    get_bgm_info(id: "deckA" | "deckB"): BGMPlayerInfo {
        return this.mirror.deck[id === "deckA" ? 0 : 1] ?? emptyBgmInfo();
    }
}
