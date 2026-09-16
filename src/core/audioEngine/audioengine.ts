import { AudioMixer, MIXER_MASTER_CHANNEL_ID } from "./mixer";
import {
    SFXPlayMode,
    SoundFileType,
    SoundLibrary,
    type BGMFile,
} from "./sounds";
import { Err, Ok, type Result } from "../types/types";
import { generateUUID } from "../util/util";
import { AudioEngineError, AudioMixerError } from "../types/err";
import type { BGMPlayerInfo } from "../store/enginestore";
import { useConfigStore } from "../store/configstore";

export type PlayResult =
    | { played: true; soundID: string; sourceID: string }
    | { played: false };

export const PlayerEvent = {
    play: "play",
    pause: "pause",
    stop: "stop",
    load: "load",
    unload: "unload_file",
    seek: "seek",
    ended: "ended",
    timeupdate: "timeupdate",
    loop: "loop",
};
export type PlayerEvent = (typeof PlayerEvent)[keyof typeof PlayerEvent];

export type DeckID = "deckA" | "deckB";

class Deck extends EventTarget {
    player: HTMLAudioElement;
    info: BGMFile | null;
    blobURL?: string;

    constructor() {
        super();
        this.player = document.createElement("audio");
        this.info = null;

        this.player.addEventListener(PlayerEvent.play, () => {
            this.dispatchEvent(new Event(PlayerEvent.play));
        });

        this.player.addEventListener(PlayerEvent.pause, () => {
            this.dispatchEvent(new Event(PlayerEvent.pause));
        });

        this.player.addEventListener(PlayerEvent.ended, () => {
            this.dispatchEvent(new Event(PlayerEvent.ended));
        });

        this.player.addEventListener(PlayerEvent.timeupdate, () => {
            this.dispatchEvent(new Event(PlayerEvent.timeupdate));
        });
    }

    async play() {
        if (!this.info) return;

        await this.player.play();
    }

    pause() {
        if (!this.info) return;

        this.player.pause();
    }

    stop() {
        if (!this.info) return;

        this.player.pause();
        this.player.currentTime = 0;
    }

    load(file: BGMFile) {
        this.unload();

        this.info = file;
        console.log("Loaded");
        this.blobURL = URL.createObjectURL(file.file);
        this.player.src = this.blobURL;

        this.dispatchEvent(new Event(PlayerEvent.load));
    }

    unload() {
        this.player.pause();
        this.player.removeAttribute("src");
        this.player.load();

        if (this.blobURL) {
            URL.revokeObjectURL(this.blobURL);
            this.blobURL = undefined;
        }

        this.info = null;

        this.dispatchEvent(new Event(PlayerEvent.unload));
    }

    seek(time: number) {
        this.player.currentTime = time;
        this.dispatchEvent(new Event(PlayerEvent.seek));
    }

    get playing() {
        return !this.player.paused;
    }

    get current_time() {
        return this.player.currentTime;
    }

    get duration() {
        return this.player.duration;
    }

    get_info(): BGMPlayerInfo {
        return {
            playing: this.playing,
            meta: this.info,
            current_time: this.current_time,
            duration: Number.isFinite(this.duration) ? this.duration : 0,
            loop: this.player.loop,
        };
    }
}

class BGMPlayer extends EventTarget {
    private deckA: Deck;
    private deckB: Deck;

    constructor() {
        super();

        this.deckA = new Deck();
        this.deckB = new Deck();

        this.bindDeckEvents(this.deckA, "deckA");
        this.bindDeckEvents(this.deckB, "deckB");
    }

    private bindDeckEvents(deck: Deck, id: DeckID) {
        for (const event of Object.values(PlayerEvent)) {
            deck.addEventListener(event, () => {
                this.dispatchEvent(
                    new CustomEvent(event, {
                        detail: { deck: id },
                    }),
                );
            });
        }
    }
    loop_bgm(id: DeckID) {
        this[id].player.loop = !this[id].player.loop;
        this.dispatchEvent(
            new CustomEvent(PlayerEvent.loop, { detail: { deck: id } }),
        );
    }
    get_info(id: DeckID) {
        return this[id].get_info();
    }

    load(id: DeckID, file: BGMFile) {
        this[id].load(file);
    }

    play(id: DeckID) {
        return this[id].play();
    }

    pause(id: DeckID) {
        this[id].pause();
    }

    stop(id: DeckID) {
        this[id].stop();
    }

    seek(id: DeckID, time: number) {
        this[id].seek(time);
    }

    unload(id: DeckID) {
        this[id].unload();
    }

    get_deck_elm(id: DeckID): HTMLAudioElement {
        return this[id].player;
    }

    reset() {
        this.deckA.unload();
        this.deckB.unload();
    }
}

export class AudioEngine extends EventTarget {
    private mixer: AudioMixer;
    private library: SoundLibrary;
    private ctx = new window.AudioContext();
    private playing: Map<string, AudioBufferSourceNode>;
    private playing_id: { source_id: string; sfx_id: string }[];
    private player: BGMPlayer;

    private is_ducking: boolean;
    private before_ducking_gain: number;

    constructor() {
        super();
        this.playing = new Map();
        this.playing_id = [];
        this.mixer = new AudioMixer(this.ctx);
        this.library = new SoundLibrary(this.ctx);
        this.player = new BGMPlayer();
        this.mixer.connect_media_elem(
            this.player.get_deck_elm("deckA"),
            "deckA",
        );
        this.mixer.connect_media_elem(
            this.player.get_deck_elm("deckB"),
            "deckB",
        );

        window.addEventListener("click", this.resume_ctx);
        window.addEventListener("touchstart", this.resume_ctx);
        window.addEventListener("touchend", this.resume_ctx);
        window.addEventListener("pointerdown", this.resume_ctx);

        this.is_ducking = false;
        this.before_ducking_gain = 1;
        for (const event of Object.values(PlayerEvent)) {
            this.player.addEventListener(event, (e) => {
                this.dispatchEvent(
                    new CustomEvent(event, {
                        detail: (e as CustomEvent).detail,
                    }),
                );
            });
        }
    }

    private resume_ctx = async () => {
        if (this.ctx.state == "suspended" || this.ctx.state == "interrupted") {
            await this.ctx.resume();
        }
    };
    createChannel(name: string): Result<string, string> {
        const result = this.mixer.createGroup(name);
        return result.ok ? Ok(name) : Err(result.value);
    }
    delete_group(name: string): Result<void, string> {
        const children = this.mixer.group_children(name);
        const result = this.mixer.delete_group(name);
        if (!result.ok) return result;

        for (const channel of children) {
            if (channel.id) this.library.set_group(channel.id, undefined);
        }
        return Ok();
    }
    rename_group(oldName: string, newName: string): Result<void, string> {
        const result = this.mixer.rename_group(oldName, newName);
        if (!result.ok) return result;

        for (const channel of this.mixer.group_children(newName)) {
            if (channel.id) this.library.set_group(channel.id, newName);
        }
        return Ok();
    }
    move_channel_to_group(id: string, newGroup?: string): Result<void, string> {
        const result = this.mixer.move_channel(id, newGroup);
        if (!result.ok) return result;
        this.library.set_group(id, newGroup);
        return Ok();
    }
    async add_sfx(option: {
        name: string;
        file: ArrayBuffer;
        id?: string;
        group?: string;
        gain?: number;
        mime?: string;
        index?: number;
    }): Promise<Result<string, string>> {
        const { id, file, group, name, gain, mime } = option;
        const sound_id = id ?? generateUUID();
        const groupname = group ?? "SFX";
        try {
            const audiobuffer = await this.ctx.decodeAudioData(file.slice(0));
            this.library.add(
                {
                    filename: name,
                    id: sound_id,
                    type: SoundFileType.SFX,
                    group: groupname,
                    mime: mime,
                },
                audiobuffer,
                { index: option.index },
            );
            const result = this.mixer.create_channel(sound_id, name, groupname);
            if (!result.ok) return Err(AudioEngineError.ChannelCreationFailed);
            this.mixer.set_gain(result.value, gain ?? 1);
            return Ok(result.value);
        } catch (e) {
            return Err(e as string);
        }
    }
    add_bgm(option: {
        name: string;
        file: Blob;
        id?: string;
        mime?: string;
    }): Result<string, string> {
        let { id, name, file, mime } = option;
        const bgm_id = id ?? generateUUID();
        this.library.add(
            {
                filename: name,
                id: bgm_id,
                type: SoundFileType.BGM,
                mime: mime ?? file.type,
            },
            file,
        );
        return Ok(bgm_id);
    }
    trim(id: string, start: number, end: number) {
        this.library.trim(id, start, end);
    }
    set_sfx_play_mode(id: string, mode: SFXPlayMode) {
        this.library.set_sfx_playmode(id, mode);
    }
    async play(
        id: string,
        options?: {
            start?: number;
            end?: number;
            onended?: (id: string) => void;
            beforestart?: (id: string) => void;
        },
    ): Promise<Result<PlayResult, AudioEngineError>> {
        const configStore = useConfigStore();

        const { maxPoly } = configStore;
        if (this.playing_id.length >= maxPoly) {
            const oldest = this.playing_id[0];
            if (oldest?.source_id) this.stop(oldest.source_id);
        }
        await this.resume_ctx();
        const source_id = generateUUID();
        const PlaybackInfo = this.library.get_PlayInfo(id);
        if (!PlaybackInfo) return Err(AudioEngineError.SoundNotFound);
        const { node, ...meta } = PlaybackInfo;
        const playMode = PlaybackInfo?.play_mode;
        if (!node) return Err(AudioEngineError.SoundNotFound);
        if (!playMode && playMode !== 0)
            return Err(AudioEngineError.SoundNotFound);

        if (playMode >= SFXPlayMode.Restart) {
            const playing = this.playing_id.find((v) => v.sfx_id == meta.id);
            if (playMode == SFXPlayMode.Ignore && playing)
                return Ok<PlayResult>({ played: false });
            if (playing) {
                this.stop(playing.source_id);
                if (playMode === SFXPlayMode.Stop)
                    return Ok<PlayResult>({ played: false });
            }
        }
        this.playing.set(source_id, node);
        this.playing_id.push({ source_id, sfx_id: id });
        this.mixer.input(id, node);

        const start = (when?: number, offset?: number, duration?: number) => {
            if (typeof options?.beforestart == "function")
                options.beforestart(id);
            node.start(when, offset, duration);
        };

        node.onended = () => {
            const index = this.playing_id.findIndex(
                (value) => value.source_id == source_id,
            );
            if (index < 0) return;
            this.playing.delete(source_id);
            this.playing_id.splice(index, 1);
            if (options?.onended) options.onended(id);
        };
        if (options) {
            const bufferDuration = node.buffer?.duration ?? 0;
            //option.startとoption.endはmetaより優先する
            //プレビューとかでしか使わないから。
            const time = Math.min(
                Math.max(0, options.start ?? meta.start_from ?? 0),
                bufferDuration,
            );
            const end = Math.min(
                Math.max(time, options.end ?? meta.end_at ?? bufferDuration),
                bufferDuration,
            );
            start(0, time, Math.max(0, end - time));
            return Ok({ played: true, soundID: id, sourceID: source_id });
        }
        if (meta.start_from != null && meta.end_at != null) {
            start(
                0,
                meta.start_from,
                Math.max(0, meta.end_at - meta.start_from),
            );
            return Ok({ played: true, soundID: id, sourceID: source_id });
        } else {
            start();
            return Ok({ played: true, soundID: id, sourceID: source_id });
        }
    }
    stop(source_id: string): Result<string, AudioEngineError> {
        if (!(source_id in this.playing))
            return Err(AudioEngineError.SpecifiedPlayingSoundNotFound);
        const id = this.playing_id.find((v) => v.source_id == source_id)
            ?.sfx_id as string;
        this.playing.get(source_id)?.stop();
        this.playing.delete(source_id);
        return Ok(id);
    }
    async dispose() {
        this.stop_all_sfx();
        this.player.reset();
        await Promise.race([
            (async () => {
                if (
                    this.ctx.state == "interrupted" ||
                    this.ctx.state == "suspended"
                ) {
                    await this.ctx.resume();
                }
                await this.ctx.close();
            })(),
            new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
        window.removeEventListener("click", this.resume_ctx);
        window.removeEventListener("touchstart", this.resume_ctx);
        window.removeEventListener("touchend", this.resume_ctx);
        window.removeEventListener("pointerdown", this.resume_ctx);
    }
    get_sfx_library() {
        return this.library.get_sfx_library();
    }
    get_bgm_library() {
        return this.library.get_bgm_library();
    }
    async get_all_bgm_blob() {
        return this.library.get_all_bgm_blob();
    }
    get_duration(id: string) {
        return this.library.get_duration(id);
    }
    get_waveform(id: string, buckets: number) {
        return this.library.get_waveform(id, buckets);
    }
    stop_all_sfx() {
        const keys = Object.keys(this.playing);
        for (const key of keys) {
            this.stop(key);
        }
    }
    discard_sound(id: string) {
        const playing_Target = this.playing_id.filter(
            (value) => value.sfx_id == id,
        );
        playing_Target.forEach((value) => {
            this.playing.get(value.source_id)?.stop();
            this.playing.delete(value.source_id);
        });
        this.library.remove(id);
        this.mixer.delete_channel(id);
    }
    get_soundinfo(id: string) {
        return this.library.get_soundinfo(id);
    }
    get_group_children(parent: string) {
        return this.mixer.group_children(parent);
    }
    get_group_names(): string[] {
        return this.mixer.get_group_names();
    }
    get_all_channels() {
        return this.mixer.get_all_channels();
    }
    set_gain(id: string, gain: number): Result<number, AudioMixerError> {
        this.library.set_gain(id, gain);
        return this.mixer.set_gain(id, gain);
    }
    get_gain(id: string) {
        return this.mixer.get_gain(id);
    }
    move_sound(id: string, toIndex: number): Result<void, string> {
        return this.library.move(id, toIndex);
    }
    reorder_sfx(order: string[]): void {
        this.library.reorder(order);
    }

    load_bgm(id: DeckID, file: BGMFile) {
        this.player.load(id, file);
    }
    load_bgm_to_deck(
        id: DeckID,
        bgmId: string,
    ): Result<void, AudioEngineError> {
        const info = this.library.get_bgm_playinfo(bgmId);
        if (!info) return Err(AudioEngineError.SoundNotFound);
        const { source, ...meta } = info;
        this.player.load(id, { ...meta, file: source });
        return Ok();
    }

    play_bgm(id: DeckID) {
        this.player.play(id);
    }

    pause_bgm(id: DeckID) {
        this.player.pause(id);
    }

    stop_bgm(id: DeckID) {
        this.player.stop(id);
    }

    seek_bgm(id: DeckID, time: number) {
        this.player.seek(id, time);
    }
    unload_bgm(id: DeckID) {
        this.player.unload(id);
    }
    get_bgm_info(id: DeckID) {
        return this.player.get_info(id);
    }
    rename(id: string, name: string) {
        return this.library.rename(id, name);
    }
    loop_bgm(id: DeckID) {
        return this.player.loop_bgm(id);
    }
    ducking(): Result<boolean, AudioMixerError> {
        if (this.is_ducking) {
            this.is_ducking = false;
            const res = this.mixer.set_gain(
                MIXER_MASTER_CHANNEL_ID,
                this.before_ducking_gain,
            );
            return res.ok ? Ok(false) : Err(res.value);
        }
        const config_store = useConfigStore();
        const gain = this.mixer.get_gain(MIXER_MASTER_CHANNEL_ID);
        if (!gain.ok) return Err(gain.value);
        this.before_ducking_gain = gain.value;
        this.is_ducking = true;
        const res = this.mixer.set_gain(
            MIXER_MASTER_CHANNEL_ID,
            gain.value * Math.pow(10, config_store.ducking_amount / 20),
            1,
        );
        return res.ok ? Ok(true) : Err(res.value);
    }
}
