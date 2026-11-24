import type { Command } from "../api/commands";
import type { Executor } from "../api/executor";
import { EngineCommands } from "../audioEngine/commands";
import { SideCarCommand, type SideCarCommandPayload } from "./sidecar";

type PayloadOf<C extends SideCarCommand> = Extract<
    SideCarCommandPayload,
    { cmd: C }
>;

export interface RemoteCommand {
    readonly command: Command<any, any>;
    readonly cmd: SideCarCommand;
    readonly toPayload: (input: any) => SideCarCommandPayload;
    readonly runRemote: (
        executor: Executor,
        payload: SideCarCommandPayload,
    ) => unknown;
}

const defineRemoteCommand = <I, C extends SideCarCommand>(
    command: Command<I, any>,
    cmd: C,
    toPayload: (input: I) => PayloadOf<C>,
    toInput: (payload: PayloadOf<C>) => I,
): RemoteCommand => ({
    command,
    cmd,
    toPayload,
    runRemote: (executor, payload) =>
        executor.run(
            command as Command<any, any>,
            toInput(payload as PayloadOf<C>),
        ),
});

export const remoteCommands: RemoteCommand[] = [
    defineRemoteCommand(
        EngineCommands.play,
        SideCarCommand.Play,
        (input) => ({
            cmd: SideCarCommand.Play,
            id: input.id,
            options:
                input.options === undefined
                    ? undefined
                    : {
                          start: input.options.start,
                          end: input.options.end,
                      },
        }),
        (payload) => ({ id: payload.id, options: payload.options }),
    ),
    defineRemoteCommand(
        EngineCommands.stop,
        SideCarCommand.Stop,
        (input) => ({ cmd: SideCarCommand.Stop, source_id: input.source_id }),
        (payload) => ({ source_id: payload.source_id }),
    ),
    defineRemoteCommand(
        EngineCommands.stop_all_sfx,
        SideCarCommand.StopAllSfx,
        () => ({ cmd: SideCarCommand.StopAllSfx }),
        () => undefined,
    ),
    defineRemoteCommand(
        EngineCommands.ducking,
        SideCarCommand.Ducking,
        () => ({ cmd: SideCarCommand.Ducking }),
        () => undefined,
    ),
    defineRemoteCommand(
        EngineCommands.set_gain,
        SideCarCommand.SetGain,
        (input) => ({
            cmd: SideCarCommand.SetGain,
            id: input.id,
            gain: input.gain,
            initialising: input.initialised,
        }),
        (payload) => ({
            id: payload.id,
            gain: payload.gain,
            initialised: payload.initialising,
        }),
    ),
    defineRemoteCommand(
        EngineCommands.play_bgm,
        SideCarCommand.PlayBgm,
        (input) => ({ cmd: SideCarCommand.PlayBgm, deck: input.id }),
        (payload) => ({ id: payload.deck }),
    ),
    defineRemoteCommand(
        EngineCommands.pause_bgm,
        SideCarCommand.PauseBgm,
        (input) => ({ cmd: SideCarCommand.PauseBgm, deck: input.id }),
        (payload) => ({ id: payload.deck }),
    ),
    defineRemoteCommand(
        EngineCommands.stop_bgm,
        SideCarCommand.StopBgm,
        (input) => ({ cmd: SideCarCommand.StopBgm, deck: input.id }),
        (payload) => ({ id: payload.deck }),
    ),
    defineRemoteCommand(
        EngineCommands.seek_bgm,
        SideCarCommand.SeekBgm,
        (input) => ({
            cmd: SideCarCommand.SeekBgm,
            deck: input.id,
            time: input.time,
        }),
        (payload) => ({ id: payload.deck, time: payload.time }),
    ),
    defineRemoteCommand(
        EngineCommands.load_bgm_to_deck,
        SideCarCommand.LoadBgmToDeck,
        (input) => ({
            cmd: SideCarCommand.LoadBgmToDeck,
            deck: input.id,
            bgmId: input.bgmId,
        }),
        (payload) => ({ id: payload.deck, bgmId: payload.bgmId }),
    ),
    defineRemoteCommand(
        EngineCommands.unload_bgm,
        SideCarCommand.UnloadBGM,
        (input) => ({ cmd: SideCarCommand.UnloadBGM, deck: input.id }),
        (payload) => ({ id: payload.deck }),
    ),
    defineRemoteCommand(
        EngineCommands.loop_bgm,
        SideCarCommand.ToggleLoop,
        (input) => ({ cmd: SideCarCommand.ToggleLoop, id: input.id }),
        (payload) => ({ id: payload.id }),
    ),
];

export const remoteCommandByCmd = new Map<SideCarCommand, RemoteCommand>(
    remoteCommands.map((def) => [def.cmd, def]),
);
