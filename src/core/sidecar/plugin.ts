import type { Executor } from "../api/executor";
import type { Hook } from "../api/hooks";
import { remoteCommands } from "./remoteCommands";
import type { SideCar, SideCarCommandPayload } from "./sidecar";

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
        for (const def of remoteCommands) {
            executor.set_hook(def.command, forward(def.toPayload));
        }
    },
});
