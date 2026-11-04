import {
    AudioEngine,
    PlayerEvent,
    type DeckID,
} from "../audioEngine/audioengine";
import {
    EngineEvent,
    Err,
    None,
    Ok,
    Some,
    type Option,
    type Result,
} from "../types/types";
import { EngineProcState } from "../store/enginestore_type";
import { EngineError, EngineException } from "../types/error_types";
import { PROJECT_FILE_EX } from "../constants";
import {
    SoundFileType,
    type SFXFile,
    type BGMFile,
    type SoundMeta,
} from "../audioEngine/sounds";
import type { AudioMixerError } from "../types/err";
import { start_from_file } from "./projectFileHandler";
import { openAudioFilePicker } from "../files/fileUtil";
import { InternalProjectManager } from "./internalProjectManager";
import { applyGuard } from "../util/util";
import { UiCommandsManager } from "../commands/uiCommands";
import {
    SideCar,
    SideCarEvent,
    type SideCarMessage,
} from "../sidecar/sidecar";
import { SideCarHostRelay } from "../sidecar/sidecarHost";
import { SideCarVisitorRelay } from "../sidecar/sidecarVisitor";
import { LogCategory, logger } from "../log/log";
import { Executor } from "../api/executor";
import {
    EngineCommands,
    SetAudioEngineCommands,
} from "../audioEngine/commands";
import type { Command } from "../api/commands";

const log = logger.module("ProjectManager");

export class ProjectManager extends InternalProjectManager {
    commands: UiCommandsManager;
    sidecar: SideCar;
    hostrelay: SideCarHostRelay;
    visitorrelay: SideCarVisitorRelay;
    executor: Executor;
    constructor() {
        super();
        log.info(LogCategory.SYSTEM, "Start", "Initialising ProjectManager");
        this.executor = new Executor();
        applyGuard(this);
        this.commands = new UiCommandsManager(
            this.engine,
            this.stateManager,
            (e) => this.error(e),
        );
        this.sidecar = new SideCar();
        this.hostrelay = new SideCarHostRelay(this.commands, this.sidecar);

        this.visitorrelay = new SideCarVisitorRelay(
            this.sidecar,
            (event, detail) => {
                if (this.sidecar.mode == "visitor")
                    this.dispatchEvent(
                        detail
                            ? new CustomEvent(event, { detail })
                            : new Event(event),
                    );
            },
        );
        this.applyEvent();
        this.set_command();
        this.set_hooks();
        log.info(
            LogCategory.SYSTEM,
            "End",
            "Finished Initialising ProjectManager",
        );
    }

    private applyEvent() {
        for (const event of Object.values(EngineEvent)) {
            this.commands.addEventListener(event, (e) =>
                this.dispatchEvent(
                    new CustomEvent(event, {
                        detail: (e as CustomEvent).detail,
                    }),
                ),
            );
            this.addEventListener(event, (e: CustomEventInit<unknown>) => {
                if (this.sidecar.mode == "host") {
                    if (
                        event === EngineEvent.ChangedLibrary ||
                        event === EngineEvent.Initialised
                    ) {
                        this.hostrelay.send_event(
                            event,
                            this.hostrelay.buildLibraryState(),
                        );
                        return;
                    }
                    if (event == EngineEvent.CrossFaded) {
                        const deckAgain = this.get_gain("deckA");
                        if (deckAgain.ok && deckAgain.value !== undefined) {
                            this.hostrelay.send_event(event, deckAgain.value);
                        }
                    }
                    this.hostrelay.send_event(event, e.detail);
                }
            });
        }
        for (const event of Object.values(PlayerEvent)) {
            this.addEventListener(
                event,
                (e: CustomEventInit<{ deck: DeckID }>) => {
                    if (this.sidecar.mode == "host") {
                        const deck = e.detail?.deck;
                        if (!deck) return;
                        this.hostrelay.send_event(event as EngineEvent, {
                            deck: deck,
                            info: this.get_bgm_info(deck),
                        });
                    }
                },
            );
        }
        window.addEventListener("panic", () => {
            this.error(EngineException.Panic);
        });
        this.sidecar.addEventListener(SideCarEvent.Connect, () =>
            this.dispatchEvent(new Event(EngineEvent.SideCarStarted)),
        );
        this.sidecar.addEventListener(SideCarEvent.Disconnect, async () => {
            if (
                this.sidecar.mode == "host" &&
                this.sidecar.connections.size > 0
            ) {
                this.dispatchEvent(new Event(EngineEvent.SideCarEnded));
                return;
            }
            await this.disconnect();
        });
        this.sidecar.addEventListener(SideCarEvent.Update, () =>
            this.dispatchEvent(new Event(EngineEvent.SideCarUpdated)),
        );
        this.sidecar.addEventListener(
            SideCarEvent.Message,
            (e: CustomEventInit<SideCarMessage>) => {
                if (this.sidecar.mode !== "host") return;
                const data = e.detail;
                if (!data) return;
                switch (data.kind) {
                    case "command":
                        try {
                            const result = this.hostrelay.excec(data.payload);
                            if (result instanceof Promise) {
                                result.catch((_err) => {});
                            }
                        } catch (err) {}
                        break;
                    case "requestsnapshot":
                        this.hostrelay.sendSnapShot();
                        break;
                }
            },
        );
    }
    private set_command() {
        SetAudioEngineCommands(this.executor, this.engine);
    }
    private set_hooks() {
        const dispatch = (event: EngineEvent, detail?: unknown) => {
            this.dispatchEvent(
                detail !== undefined
                    ? new CustomEvent(event, { detail })
                    : new Event(event),
            );
        };
        // 再生開始/終了はエンジン側コールバックでしか拾えないため、beforeProcでoptionsへ注入する
        this.executor.set_hook(EngineCommands.play, {
            beforeProc: ({ input }) => {
                input.options = {
                    ...input.options,
                    beforestart: (id: string) =>
                        dispatch(EngineEvent.PlaySFX, { id }),
                    onended: (id: string) =>
                        dispatch(EngineEvent.StopSFX, { id }),
                };
            },
        });
        this.executor.set_hook(EngineCommands.stop, {
            afterProc: (result) => {
                if (result?.ok) dispatch(EngineEvent.StopSFX, { id: result.value });
            },
        });
        const markChangedOnOk = {
            afterProc: (result: Result<unknown, unknown>) => {
                if (result?.ok) this.stateManager.markAsChanged();
            },
        };
        for (const command of [
            EngineCommands.create_group,
            EngineCommands.delete_group,
            EngineCommands.rename_group,
            EngineCommands.move_sound_to_group,
            EngineCommands.move_sound,
            EngineCommands.rename,
        ]) {
            this.executor.set_hook(command, markChangedOnOk);
        }
        const markChanged = {
            afterProc: () => {
                this.stateManager.markAsChanged();
            },
        };
        for (const command of [
            EngineCommands.trim,
            EngineCommands.set_sfx_play_mode,
            EngineCommands.discard_sound,
        ]) {
            this.executor.set_hook(command, markChanged);
        }
        this.executor.set_hook(EngineCommands.set_gain, {
            afterProc: (result, input) => {
                if (input?.id === "deckA") dispatch(EngineEvent.CrossFaded);
                if (result?.ok) {
                    dispatch(EngineEvent.GainChanged);
                    if (!input?.initialised) this.stateManager.markAsChanged();
                }
            },
        });
        this.executor.set_hook(EngineCommands.ducking, {
            afterProc: (result) => {
                if (result?.ok)
                    dispatch(
                        result.value
                            ? EngineEvent.DuckingActivated
                            : EngineEvent.DuckingDeactivated,
                    );
            },
        });
    }
    private checkStorage(): boolean {
        if (!this.storageManager.is_initialised()) {
            this.error(EngineError.StorageNotReady);
            return false;
        }
        return true;
    }

    async start_with_blank(skip_dialog?: boolean) {
        if (!skip_dialog) if (!this.stateManager.leaveConfirm()) return;
        await this.engine.dispose();
        this.engine = new AudioEngine();
        this.commands.replace_engine(this.engine);
        this.set_command();
        await this.init(undefined, true);
        this.dispatchEvent(new Event(EngineEvent.ChangedLibrary));
    }

    async start_from_file(file?: File): Promise<Result<void, string>> {
        if (!this.stateManager.leaveConfirm()) return Ok();

        const result = await start_from_file(file);
        if (!result.ok) {
            this.error(EngineError.InvalidLVSFFile);
            return Err(result.value);
        }
        if (typeof result.value === "string") return Ok();

        const { filename, sfx, bgm, load_failed } = result.value;
        await this.init(filename);
        this.commands.replace_engine(this.engine);
        this.set_command();

        if (load_failed) this.warn(EngineError.PartialSoundLoadFailed);

        await this.add_sfx(sfx);
        await this.add_bgm(bgm);

        this.fin_proc();
        this.stateManager.markAsSaved();
        this.dispatchEvent(new Event(EngineEvent.LoadedPrj));

        return Ok();
    }

    async add_bgm(musics?: BGMFile[], option?: { files: File[] }) {
        if (!this.checkStorage()) return;

        let files: BGMFile[] = [];

        if (!musics) {
            let audiofiles: Option<File[]>;
            if (option && option.files) {
                audiofiles = Some(option.files);
            } else {
                audiofiles = await openAudioFilePicker();
            }
            this.proc_event(EngineProcState.Loading);
            if (!audiofiles.some) {
                this.fin_proc();
                return;
            }

            let add_failed = false;
            for (const blob of audiofiles.value) {
                const id = this.engine.add_bgm({
                    name: blob.name,
                    file: blob,
                    mime: blob.type,
                });

                if (!id.ok) {
                    add_failed = true;
                    continue;
                }
                files.push({
                    id: id.value,
                    file: blob,
                    filename: blob.name,
                    type: SoundFileType.BGM,
                });
            }
            if (add_failed) this.warn(EngineError.PartialSoundAddFailed);
        } else {
            this.proc_event(EngineProcState.Loading);
            files = musics;
            for (const sound of files) {
                const result = this.engine.add_bgm({
                    name: sound.filename,
                    file: sound.file,
                    id: sound.id,
                    mime: sound.mime,
                });
                if (!result.ok) this.error(result.value);
            }
        }

        this.proc_event(EngineProcState.Writing);

        this.fin_proc();
        this.stateManager.markAsChanged();
    }

    async add_sfx(sounds?: SFXFile[], option?: { files: File[] }) {
        if (!this.checkStorage()) return;

        let files: SFXFile[] = [];

        if (!sounds) {
            let audios: Option<File[]>;
            if (option && option.files) {
                audios = Some(option.files);
            } else {
                audios = await openAudioFilePicker();
            }
            if (!audios.some) {
                this.fin_proc();
                return;
            }
            let add_failed = false;
            await Promise.allSettled(
                audios.value.map(async (audiofile) => {
                    const bin = await audiofile.arrayBuffer();
                    const id = await this.engine.add_sfx({
                        name: audiofile.name,
                        file: bin,
                        mime: audiofile.type,
                    });

                    if (!id.ok) {
                        add_failed = true;
                        return;
                    }
                    files.push({
                        id: id.value,
                        file: bin,
                        filename: audiofile.name,
                        type: SoundFileType.SFX,
                    });
                }),
            );
            if (add_failed) this.warn(EngineError.PartialSoundAddFailed);
        } else {
            this.proc_event(EngineProcState.Loading);
            files = sounds;
            await Promise.allSettled(
                files.map(async (sound) => {
                    const result = await this.engine.add_sfx({
                        name: sound.filename,
                        file: sound.file,
                        id: sound.id,
                        group: sound.group,
                        gain: sound.gain,
                        mime: sound.mime,
                    });
                    if (!result.ok) {
                        this.error(result.value);
                        return;
                    }

                    if (
                        sound.start_from !== undefined &&
                        sound.end_at !== undefined
                    )
                        this.engine.trim(
                            result.value,
                            sound.start_from,
                            sound.end_at,
                        );

                    if (sound.play_mode !== undefined)
                        this.engine.set_sfx_play_mode(
                            result.value,
                            sound.play_mode,
                        );
                }),
            );
            this.engine.reorder_sfx(files.map((sound) => sound.id));
        }
        this.proc_event(EngineProcState.Writing);
        try {
            await this.storageManager.save_sound_cache(files);
        } catch (e) {
            this.error(e as any);
        }

        this.fin_proc();
        this.stateManager.markAsChanged();
    }

    async export() {
        if (!this.checkStorage()) return;

        this.proc_event(EngineProcState.Proccessing);

        const files = await this.storageManager.load_sound_cache();
        if (!files.ok) {
            this.error(files.value);
            this.fin_proc();
            return;
        }

        const { LVSFFile } = await import("../files/lvsf");
        const lvsffile = new LVSFFile();

        const library: Record<string, SoundMeta> = {
            ...this.get_sfx_library(),
            ...this.get_bgm_library(),
        };

        const sfx_filesMap: Record<string, ArrayBuffer> = Object.fromEntries(
            files.value.map(({ id, file }) => [id, file]),
        );
        const bgm_filesMap = await this.engine.get_all_bgm_blob();
        const fileMap = { ...sfx_filesMap, ...bgm_filesMap };

        const missing = lvsffile.addFile(fileMap, library);
        if (missing) this.warn(EngineError.MissingCachedAudioForExport);

        const blob = lvsffile.export();
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.download = `${this.projectname}.${PROJECT_FILE_EX}`;
        a.href = url;
        a.click();

        URL.revokeObjectURL(url);
        this.stateManager.markAsSaved();
        this.fin_proc();
    }

    get_sfx_library() {
        return this.commands.get_sfx_library();
    }
    get_bgm_library() {
        return this.commands.get_bgm_library();
    }
    get_duration(id: string) {
        return this.commands.get_duration(id);
    }
    get_waveform(id: string, buckets: number) {
        return this.commands.get_waveform(id, buckets);
    }
    get_soundinfo(id: string) {
        return this.commands.get_soundinfo(id);
    }
    get_group_children(parent: string) {
        return this.commands.get_group_children(parent);
    }
    get_group_names(): string[] {
        return this.commands.get_group_names();
    }

    get_bgm_info(id: "deckA" | "deckB") {
        return this.commands.get_bgm_info(id);
    }
    get_gain(id: string): Result<number, AudioMixerError> {
        return this.commands.get_gain(id);
    }
    async create_host(): Promise<
        Option<{
            offer: RTCSessionDescription | null;
            id: string;
        }>
    > {
        const offer = await this.sidecar.createHost();
        if (!offer.ok) return None();
        return Some({ offer: offer.value.offer, id: offer.value.id });
    }
    async join_host(
        offer: RTCSessionDescription,
    ): Promise<Result<RTCSessionDescription, string>> {
        const answer = await this.sidecar.joinHost(offer);
        if (!answer.ok) {
            return Err(EngineError.CouldNotConnectToHost);
        }
        return Ok(answer.value);
    }
    async apply_answer(
        id: string,
        answer: RTCSessionDescription,
    ): Promise<Result<void, string>> {
        const res = await this.sidecar.applyAnswer(id, answer);
        if (res.ok) {
            return Ok(res);
        }
        return Err(res.value);
    }
    get_sidecar_mode(): "host" | "visitor" | undefined {
        return this.sidecar.mode ?? undefined;
    }
    async disconnect(id?: string) {
        if (id) {
            return this.sidecar.disconnect_peer(id, { reason: "from ui" });
        }
        const mode = this.sidecar.mode;
        this.sidecar.reset();
        if (mode == "visitor") {
            await this.start_with_blank(true);
        }
        this.dispatchEvent(new Event(EngineEvent.SideCarEnded));
        return;
    }
    get_connections() {
        return Array.from(this.sidecar.connections, ([id, connection]) => ({
            id,
            device_info: connection.device_info,
        }));
    }
    async run<I, O>(
        command: Command<I, O>,
        ...args: I extends void ? [] : [input: I]
    ): Promise<O> {
        return this.executor.run(command, ...args);
    }
    runSync<I, O>(
        command: Command<I, O>,
        ...args: I extends void ? [] : [input: I]
    ): O {
        return this.executor.runSync(command, ...args);
    }
}
