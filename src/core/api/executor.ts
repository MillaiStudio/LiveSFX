import { logger } from "../log/log";
import type { Command } from "./commands";
import type { Hook } from "./hooks";

const log = logger.module("Executor");

type Handler<I, O> = (input: I) => O | Promise<O>;

export interface CommandProc<I, O> {
    hanlder: Handler<I, O>;
}

export class Executor {
    private handlers = new Map<string, CommandProc<any, any>>();
    private hooks = new Map<string, Hook>();

    set_hook(target: Command<any, any>, hook: Hook) {
        log.debug("SYSTEM", "set_hook", `hook name : ${target.name}`);
        this.hooks.set(target.name, hook);
    }
    register<I, O>(command: Command<I, O>, proccess: CommandProc<I, O>): void {
        log.debug("SYSTEM", "registar command", `registard : ${command.name}`);
        this.handlers.set(command.name, proccess);
    }
    async run<I, O>(
        command: Command<I, O>,
        ...args: I extends void ? [] : [input: I]
    ): Promise<O> {
        log.info("SYSTEM", "run", `run : ${command.name}`);
        const proc = this.handlers.get(command.name);
        const hook = this.hooks.get(command.name);
        let run = true;
        let res;
        if (!proc || !proc.hanlder) {
            log.error(
                "SYSTEM",
                "HandlerError",
                `Handler not registered: ${command.name}`,
            );
            throw new Error(`Handler not registered: ${command.name}`);
        }
        if (hook?.beforeProc) {
            log.debug("SYSTEM", "HookedBeforeRun", `${command.name} - before`);
            res = hook.beforeProc(() => (run = false));
        }
        if (run) res = await proc.hanlder(args[0]);
        if (hook?.afterProc) {
            log.debug("SYSTEM", "HookedAfterRun", `${command.name} - after`);
            res = hook.afterProc();
        }
        log.info("SYSTEM", "Ran", `Ran command-${command.name}`, { data: res });
        return await res;
    }
}
