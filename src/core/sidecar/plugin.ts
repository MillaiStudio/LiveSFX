import type { Executor } from "../api/executor";
import type { Hook } from "../api/hooks";
import { EngineCommands } from "../audioEngine/commands";
import {
    SideCarCommand,
    type SideCar,
    type SideCarCommandPayload,
} from "./sidecar";

export const createSideCarPlugin = (sidecar: SideCar) => ({
    install: (executor: Executor) => {
        const forward = (
            toPayload: (input: any) => SideCarCommandPayload,
        ): Hook => ({
            beforeProc: ({ input, prevent }) => {
                if (sidecar.mode !== "visitor") return;
                sidecar.send_command(toPayload(input));
                prevent();
            },
        });
        executor.set_hook(
            EngineCommands.play,
            forward((input: { id: string; options?: { start?: number; end?: number } }) => ({
                cmd: SideCarCommand.Play,
                id: input.id,
                options:
                    input.options === undefined
                        ? undefined
                        : {
                              start: input.options.start,
                              end: input.options.end,
                          },
            })),
        );
        executor.set_hook(
            EngineCommands.stop,
            forward((input: { source_id: string }) => ({
                cmd: SideCarCommand.Stop,
                source_id: input.source_id,
            })),
        );
        executor.set_hook(
            EngineCommands.stop_all_sfx,
            forward(() => ({ cmd: SideCarCommand.StopAllSfx })),
        );
        executor.set_hook(
            EngineCommands.ducking,
            forward(() => ({ cmd: SideCarCommand.Ducking })),
        );
        executor.set_hook(
            EngineCommands.set_gain,
            forward((input: { id: string; gain: number; initialised?: boolean }) => ({
                cmd: SideCarCommand.SetGain,
                id: input.id,
                gain: input.gain,
                initialising: input.initialised,
            })),
        );
        executor.set_hook(
            EngineCommands.play_bgm,
            forward((input: { id: "deckA" | "deckB" }) => ({
                cmd: SideCarCommand.PlayBgm,
                deck: input.id,
            })),
        );
        executor.set_hook(
            EngineCommands.pause_bgm,
            forward((input: { id: "deckA" | "deckB" }) => ({
                cmd: SideCarCommand.PauseBgm,
                deck: input.id,
            })),
        );
        executor.set_hook(
            EngineCommands.stop_bgm,
            forward((input: { id: "deckA" | "deckB" }) => ({
                cmd: SideCarCommand.StopBgm,
                deck: input.id,
            })),
        );
        executor.set_hook(
            EngineCommands.seek_bgm,
            forward((input: { id: "deckA" | "deckB"; time: number }) => ({
                cmd: SideCarCommand.SeekBgm,
                deck: input.id,
                time: input.time,
            })),
        );
        executor.set_hook(
            EngineCommands.load_bgm_to_deck,
            forward((input: { id: "deckA" | "deckB"; bgmId: string }) => ({
                cmd: SideCarCommand.LoadBgmToDeck,
                deck: input.id,
                bgmId: input.bgmId,
            })),
        );
        executor.set_hook(
            EngineCommands.unload_bgm,
            forward((input: { id: "deckA" | "deckB" }) => ({
                cmd: SideCarCommand.UnloadBGM,
                deck: input.id,
            })),
        );
        executor.set_hook(
            EngineCommands.loop_bgm,
            forward((input: { id: "deckA" | "deckB" }) => ({
                cmd: SideCarCommand.ToggleLoop,
                id: input.id,
            })),
        );
    },
});
