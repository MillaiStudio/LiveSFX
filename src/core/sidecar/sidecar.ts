import { EngineEvent, Err, Ok, type Result } from "../types/types";
import type { SoundMeta } from "../audioEngine/sounds";
import type { MixerChannelSnapshot } from "../audioEngine/mixer";
import type { BGMPlayerInfo } from "../store/enginestore";
import type { DeckID } from "../audioEngine/audioengine";
import { generateUUID } from "../util/util";
const waitIceComplete = (pc: RTCPeerConnection): Promise<void> => {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            clearTimeout(time);
            pc.removeEventListener("icegatheringstatechange", listener);
        };
        const time = setTimeout(() => {
            reject();
        }, 10000);
        if (pc.iceGatheringState === "complete") {
            cleanup();
            resolve();
            return;
        }
        const listener = () => {
            if (pc.iceGatheringState === "complete") {
                pc.removeEventListener("icegatheringstatechange", listener);
                cleanup();
                resolve();
            }
        };
        pc.addEventListener("icegatheringstatechange", listener);
    });
};

export const SideCarError = {
    NotConnected: "noteconnected",
    ImHostNotVisitor: "imhost",
    IceTimeOut: "icetimeout",
} as const;

export type SideCarError = (typeof SideCarError)[keyof typeof SideCarError];
export const SideCarEvent = {
    Connect: "connect",
    Disconnect: "disconnect",
    Message: "message",
    Update: "update",
} as const;

export type SideCarEvent = (typeof SideCarEvent)[keyof typeof SideCarEvent];
export const SideCarCommand = {
    Play: "play",
    Stop: "stop",
    StopAllSfx: "stop_all_sfx",
    Ducking: "ducking",
    SetGain: "set_gain",
    PlayBgm: "play_bgm",
    PauseBgm: "pause_bgm",
    StopBgm: "stop_bgm",
    SeekBgm: "seek_bgm",
    LoadBgmToDeck: "load_bgm_to_deck",
    UnloadBGM: "eject_bgm",
    ToggleLoop: "toggleloop",
} as const;
export type SideCarCommand =
    (typeof SideCarCommand)[keyof typeof SideCarCommand];

export type SideCarCommandPayload =
    | {
          cmd: typeof SideCarCommand.Play;
          id: string;
          options?: { start?: number; end?: number };
      }
    | { cmd: typeof SideCarCommand.Stop; source_id: string }
    | { cmd: typeof SideCarCommand.StopAllSfx }
    | { cmd: typeof SideCarCommand.Ducking }
    | {
          cmd: typeof SideCarCommand.SetGain;
          id: string;
          gain: number;
          initialising?: boolean;
      }
    | { cmd: typeof SideCarCommand.PlayBgm; deck: DeckID }
    | { cmd: typeof SideCarCommand.PauseBgm; deck: DeckID }
    | { cmd: typeof SideCarCommand.StopBgm; deck: DeckID }
    | {
          cmd: typeof SideCarCommand.SeekBgm;
          deck: DeckID;
          time: number;
      }
    | {
          cmd: typeof SideCarCommand.LoadBgmToDeck;
          deck: DeckID;
          bgmId: string;
      }
    | {
          cmd: typeof SideCarCommand.UnloadBGM;
          deck: DeckID;
      }
    | {
          cmd: typeof SideCarCommand.ToggleLoop;
          id: DeckID;
      };

export interface SideCarStateSnapshot {
    sfx_library: Record<string, SoundMeta>;
    bgm_library: Record<string, SoundMeta>;
    groupNames: string[];
    channels: MixerChannelSnapshot[];
    playing_sfx: string[];
    deck: [BGMPlayerInfo, BGMPlayerInfo];
    ducking: boolean;
}

export type SideCarMessage =
    | { kind: "snapshot"; state: SideCarStateSnapshot }
    | { kind: "event"; event: EngineEvent; detail: unknown }
    | { kind: "msg"; value: string }
    | { kind: "command"; payload: SideCarCommandPayload }
    | { kind: "visitor_device_info"; payload: DeviceInfo }
    | { kind: "requestsnapshot" };

export interface DeviceInfo {
    name: string;
    id: string;
}

export interface Connections {
    id: string;
    peer: RTCPeerConnection;
    channel?: RTCDataChannel;
    device_info?: DeviceInfo;
}

export class SideCar extends EventTarget {
    connections: Map<string, Connections>;
    mode?: "host" | "visitor";
    device_id: string;
    name: string;
    constructor() {
        super();
        const id = generateUUID();
        this.name = (navigator.platform ?? "Unknown") + "上のLiveSFX";
        this.connections = new Map();
        this.device_id = id;
    }
    private createPeer(id: string) {
        const connection: Connections = {
            id: id,
            peer: new RTCPeerConnection(),
        };
        connection.peer.ondatachannel = (e) => {
            connection.channel = e.channel;
            this.attachChannel(id);
        };
        this.connections.set(id, connection);
        return connection;
    }
    get connected_to_host() {
        const to_host = this.connections.get(this.device_id);
        return (
            to_host &&
            to_host.peer.connectionState === "connected" &&
            to_host.channel &&
            to_host.channel?.readyState === "open"
        );
    }
    private attachChannel(id: string) {
        const channel = this.connections.get(id)?.channel;
        if (!channel) return;
        const handleOpen = () => {
            if (!this.mode) this.mode = "host";
            if (this.mode == "visitor") {
                this.send({ kind: "requestsnapshot" });
                this.send({
                    kind: "visitor_device_info",
                    payload: {
                        name: this.name,
                        id: this.device_id,
                    },
                });
            }
            this.dispatchEvent(new Event(SideCarEvent.Connect));
        };
        if (channel.readyState == "open") handleOpen();
        channel.onopen = handleOpen;

        channel.onclose = () => {
            console.log("closed");
            this.connections.delete(id);
            this.dispatchEvent(
                new CustomEvent(SideCarEvent.Disconnect, {
                    detail: { mode: this.mode },
                }),
            );
        };

        channel.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data) as SideCarMessage;
                if (data.kind == "visitor_device_info") {
                    const target = this.connections.get(id);
                    if (!target) return;
                    target.device_info = data.payload;
                    this.dispatchEvent(new Event(SideCarEvent.Update));
                }
                this.dispatchEvent(
                    new CustomEvent(SideCarEvent.Message, {
                        detail: data,
                    }),
                );
            } catch (error) {
                console.error("Invalid SideCar message", error);
            }
        };
    }
    async createHost(): Promise<
        Result<{ offer: RTCSessionDescription | null; id: string }, string>
    > {
        if (this.mode !== "host") this.reset();
        const peer_id = generateUUID();
        const target = this.createPeer(peer_id);
        target.channel = target.peer.createDataChannel("LiveSFX", {
            maxRetransmits: 0,
        });
        this.attachChannel(peer_id);

        const offer = await target.peer.createOffer();
        await target.peer.setLocalDescription(offer);
        try {
            await waitIceComplete(target.peer);
        } catch {
            return Err(SideCarError.IceTimeOut);
        }

        return Ok({ offer: target.peer.localDescription, id: peer_id });
    }

    async joinHost(
        offer: RTCSessionDescriptionInit,
    ): Promise<Result<RTCSessionDescription, unknown>> {
        if (this.connections.has(this.device_id))
            this.disconnect_peer(this.device_id);
        const connection = this.createPeer(this.device_id);
        try {
            await connection.peer.setRemoteDescription(offer);
            const answer = await connection.peer.createAnswer();
            await connection.peer.setLocalDescription(answer);
            try {
                await waitIceComplete(connection.peer);
            } catch {
                return Err(SideCarError.IceTimeOut);
            }
            if (!connection.peer.localDescription) return Err("");
            this.mode = "visitor";
            const self = this.connections.get(this.device_id)!;
            this.connections.clear();
            this.connections.set(this.device_id, self);
            connection.peer.addEventListener(
                "connectionstatechange",
                this.apply_watchdog(connection.id),
            );
            return Ok(connection.peer.localDescription);
        } catch (e) {
            return Err(e);
        }
    }

    async applyAnswer(
        id: string,
        answer: RTCSessionDescriptionInit,
    ): Promise<Result<void, string>> {
        const target_peer = this.connections.get(id);
        if (!target_peer) return Err("Peer Not Found");
        await target_peer.peer.setRemoteDescription(answer);
        if (target_peer.peer.connectionState === "connected") {
            this.mode = "host";
            target_peer.peer.addEventListener(
                "connectionstatechange",
                this.apply_watchdog(target_peer.id),
            );
            return Ok();
        }
        return new Promise<Result<void, string>>((resolve) => {
            const handler = () => {
                switch (target_peer.peer.connectionState) {
                    case "connected":
                        this.mode = "host";
                        cleanup();
                        resolve(Ok());
                        break;
                    case "failed":
                    case "closed":
                    case "disconnected":
                        cleanup();
                        resolve(Err("connection failed"));
                        break;
                }
            };
            const cleanup = () => {
                clearTimeout(time);
                target_peer.peer.removeEventListener(
                    "connectionstatechange",
                    handler,
                );
                target_peer.peer.addEventListener(
                    "connectionstatechange",
                    this.apply_watchdog(target_peer.id),
                );
            };
            const time = setTimeout(() => {
                cleanup();
                resolve(Err("timeout"));
            }, 10000);
            target_peer.peer.addEventListener("connectionstatechange", handler);
        });
    }
    apply_watchdog(id: string) {
        const target = this.connections.get(id);
        const disconnect = this.disconnect_peer.bind(this);
        return function watchdog() {
            if (!target) return;
            switch (target.peer.connectionState) {
                case "disconnected":
                case "closed":
                    disconnect(target.id);
                    break;
            }
        };
    }
    send(message: SideCarMessage): Result<void, SideCarError> {
        let fails_channel = [];
        for (const [_key, target] of this.connections) {
            try {
                if (target.channel && target.channel.readyState == "open")
                    target.channel?.send(JSON.stringify(message));
            } catch {
                fails_channel.push(target);
            }
        }
        if (fails_channel.length > 0) {
            fails_channel.forEach((v) => {
                this.disconnect_peer(v.id);
            });
            return Err(SideCarError.NotConnected);
        }
        return Ok();
    }
    reset() {
        try {
            for (const [_key, target] of this.connections) {
                target.channel?.close();
                target.peer.close();
            }
            this.connections.clear();
        } catch {}
        this.mode = undefined;
    }

    send_command(
        command_and_payload: SideCarCommandPayload,
    ): Result<void, SideCarError> {
        if (!this.connected_to_host) return Err(SideCarError.NotConnected);
        if (this.mode === "visitor") {
            const request: SideCarMessage = {
                kind: "command",
                payload: command_and_payload,
            };
            this.send(request);
            return Ok();
        }
        return Err(SideCarError.ImHostNotVisitor);
    }
    disconnect_peer(id: string) {
        const target = this.connections.get(id);
        if (!target) return;
        target.channel?.close();
        target.peer.close();
        this.connections.delete(id);
        this.dispatchEvent(new Event(SideCarEvent.Disconnect));
    }
}
