import { EngineEvent, Err, Ok, type Result } from "../types/types";
import type { SoundMeta } from "../audioEngine/sounds";
import type { MixerChannelSnapshot } from "../audioEngine/mixer";
import type { BGMPlayerInfo } from "../store/enginestore";
import type { DeckID } from "../audioEngine/audioengine";
import { generateUUID } from "../util/util";
import { LogCategory, logger } from "../log/log";

const log = logger.module("SideCar");
const { NETWORK } = LogCategory;
const waitIceComplete = (pc: RTCPeerConnection): Promise<void> => {
    return new Promise((resolve, reject) => {
        log.debug(NETWORK, "IceGathering", "Gathering Ice");
        const cleanup = () => {
            clearTimeout(time);
            pc.removeEventListener("icegatheringstatechange", listener);
        };
        const time = setTimeout(() => {
            log.warn(NETWORK, "IceGathering", "Gathering Ice timed out");
            reject();
        }, 10000);
        if (pc.iceGatheringState === "complete") {
            log.debug(NETWORK, "IceGathering", "Done Gathering Ice");
            cleanup();
            resolve();
            return;
        }
        const listener = () => {
            if (pc.iceGatheringState === "complete") {
                pc.removeEventListener("icegatheringstatechange", listener);
                log.debug(NETWORK, "IceGathering", "Done Gathering Ice");
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
        log.info(NETWORK, "CreatePeer", "creating peer");
        const connection: Connections = {
            id: id,
            peer: new RTCPeerConnection(),
        };
        connection.peer.ondatachannel = (e) => {
            log.info(NETWORK, "ChannelEstablished", "channel established");
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
            log.info(NETWORK, "Close", "closed sidecar connection", {
                data: { id },
            });
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
                log.info(NETWORK, "Message", `Received message from ${id}`, {
                    data: { data },
                });
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
                log.error(
                    NETWORK,
                    "Message",
                    "Recieved message but can't procces",
                    { data: { error } },
                );
            }
        };
    }
    async createHost(): Promise<
        Result<{ offer: RTCSessionDescription | null; id: string }, string>
    > {
        log.info(NETWORK, "createHost", "create host requested");
        if (this.mode !== "host") {
            log.debug(NETWORK, "createHost", "initialising state, I'm visitor");
            this.reset();
        }
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
            log.error(NETWORK, "createHost", SideCarError.IceTimeOut);
            return Err(SideCarError.IceTimeOut);
        }
        log.info(NETWORK, "createHost", "Succeeded to create offer");
        return Ok({ offer: target.peer.localDescription, id: peer_id });
    }

    async joinHost(
        offer: RTCSessionDescriptionInit,
    ): Promise<Result<RTCSessionDescription, unknown>> {
        log.info(NETWORK, "joinHost", "requested join host");
        if (this.connections.has(this.device_id)) {
            log.info(
                NETWORK,
                "joinHost",
                "request close existing sidecar session",
            );
            this.disconnect_peer(this.device_id, { reason: "being visitor" });
        }
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
            log.info(
                NETWORK,
                "joinHost",
                "Succeeded to apply offer and create answer",
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
        log.info(NETWORK, "applyAnswer", "Requested apply answer");
        const target_peer = this.connections.get(id);
        if (!target_peer) {
            log.error(
                NETWORK,
                "applyAnswer",
                "Answer received from unknown visitor",
            );
            return Err("Peer Not Found");
        }
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
            log.info(
                NETWORK,
                "applyAnswer",
                "Waiting for connection to be establish",
            );
            const handler = () => {
                switch (target_peer.peer.connectionState) {
                    case "connected":
                        this.mode = "host";
                        cleanup();
                        log.info(
                            NETWORK,
                            "applyAnswer",
                            "Connection has been established",
                        );
                        resolve(Ok());
                        break;
                    case "failed":
                    case "closed":
                    case "disconnected":
                        cleanup();
                        log.error(
                            NETWORK,
                            "applyAnswer",
                            "Failed to establish connection",
                        );
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
                log.warn(NETWORK, "applyAnswer", "Timed out");
                resolve(Err("timeout"));
            }, 10000);
            target_peer.peer.addEventListener("connectionstatechange", handler);
        });
    }
    apply_watchdog(id: string) {
        log.debug(NETWORK, "apply_watchdog", "Applying watch dog");
        const target = this.connections.get(id);
        const disconnect = this.disconnect_peer.bind(this);
        return function watchdog() {
            if (!target) return;
            switch (target.peer.connectionState) {
                case "disconnected":
                case "closed":
                    log.info(NETWORK, "connectionDead", "Connection is dead");
                    disconnect(target.id);
                    break;
            }
        };
    }
    send(message: SideCarMessage): Result<void, SideCarError> {
        let fails_channel = [];
        log.info(NETWORK, "Send", "Sending message");
        for (const [key, target] of this.connections) {
            try {
                if (target.channel && target.channel.readyState == "open") {
                    log.debug(NETWORK, "Send", `{send to ${key}`);
                    target.channel?.send(JSON.stringify(message));
                }
            } catch {
                log.warn(NETWORK, "Send", `{failed to send to ${key}`);
                fails_channel.push(target);
            }
        }
        if (fails_channel.length > 0) {
            log.warn(
                NETWORK,
                "SendFails",
                "Can't send a message to some peers",
            );
            fails_channel.forEach((v) => {
                this.disconnect_peer(v.id, { reason: "dead_peer" });
            });
            return Err(SideCarError.NotConnected);
        }
        return Ok();
    }
    reset() {
        log.info(NETWORK, "Reset", "Disconnect and Reset SideCar");
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
        log.info(NETWORK, "SendCommand", "Sending command", {
            data: command_and_payload,
        });

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
    disconnect_peer(id: string, options?: { reason?: string }) {
        log.info(NETWORK, "requestDisconnect", "requested disconnect", {
            data: { reason: options?.reason },
        });
        const target = this.connections.get(id);
        if (!target) {
            log.warn(NETWORK, "requestDisconnect", "connection not exist");
            return;
        }
        log.info(NETWORK, "requestDisconnect", "Closing...");
        target.channel?.close();
        target.peer.close();
        this.connections.delete(id);
        log.info(NETWORK, "requestDisconnect", "Closed");
        this.dispatchEvent(new Event(SideCarEvent.Disconnect));
    }
}
