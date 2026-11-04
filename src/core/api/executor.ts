import { logger } from "../log/log";
import type { Command } from "./commands";
import type { Hook } from "./hooks";

const log = logger.module("Executor");

type Handler<I, O> = (input: I) => O | Promise<O>;

export interface CommandProc<I, O> {
    hanlder: Handler<I, O>;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return (
        !!value &&
        typeof (value as { then?: unknown }).then === "function"
    );
}

export class Executor {
    private handlers = new Map<string, CommandProc<any, any>>();
    private hooks = new Map<string, Hook[]>();

    set_hook(target: Command<any, any>, hook: Hook) {
        log.debug("SYSTEM", "set_hook", `hook name : ${target.name}`);
        const list = this.hooks.get(target.name) ?? [];
        list.push(hook);
        this.hooks.set(target.name, list);
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
        const hooks = this.hooks.get(command.name) ?? [];
        if (!proc || !proc.hanlder) {
            log.error(
                "SYSTEM",
                "HandlerError",
                `Handler not registered: ${command.name}`,
            );
            throw new Error(`Handler not registered: ${command.name}`);
        }
        let run = true;
        const prevent = () => (run = false);
        for (const hook of hooks) {
            if (hook.beforeProc) {
                log.debug(
                    "SYSTEM",
                    "HookedBeforeRun",
                    `${command.name} - before`,
                );
                await hook.beforeProc({ input: args[0], prevent });
            }
        }
        let res;
        if (run) {
            res = await proc.hanlder(args[0]);
            for (const hook of hooks) {
                if (hook.afterProc) {
                    log.debug(
                        "SYSTEM",
                        "HookedAfterRun",
                        `${command.name} - after`,
                    );
                    await hook.afterProc(res, args[0]);
                }
            }
        }
        log.info("SYSTEM", "Ran", `Ran command-${command.name}`, { data: res });
        return await res;
    }
    // 同期コマンド用の実行経路。awaitを挟まず、結果をそのまま返す。
    // ハンドラやhookがPromiseを返した場合は同期では扱えないためエラーにする。
    runSync<I, O>(
        command: Command<I, O>,
        ...args: I extends void ? [] : [input: I]
    ): O {
        log.info("SYSTEM", "runSync", `runSync : ${command.name}`);
        const proc = this.handlers.get(command.name);
        const hooks = this.hooks.get(command.name) ?? [];
        if (!proc || !proc.hanlder) {
            log.error(
                "SYSTEM",
                "HandlerError",
                `Handler not registered: ${command.name}`,
            );
            throw new Error(`Handler not registered: ${command.name}`);
        }
        let run = true;
        const prevent = () => (run = false);
        for (const hook of hooks) {
            if (hook.beforeProc) {
                log.debug(
                    "SYSTEM",
                    "HookedBeforeRun",
                    `${command.name} - before`,
                );
                const hooked = hook.beforeProc({ input: args[0], prevent });
                if (isPromiseLike(hooked)) {
                    log.error(
                        "SYSTEM",
                        "HandlerError",
                        `Async hook cannot run in runSync: ${command.name}`,
                    );
                    throw new Error(
                        `Async hook cannot run in runSync: ${command.name}`,
                    );
                }
            }
        }
        let res;
        if (run) {
            res = proc.hanlder(args[0]);
            if (isPromiseLike(res)) {
                log.error(
                    "SYSTEM",
                    "HandlerError",
                    `Async handler cannot run in runSync: ${command.name}`,
                );
                throw new Error(
                    `Async handler cannot run in runSync: ${command.name}`,
                );
            }
            for (const hook of hooks) {
                if (hook.afterProc) {
                    log.debug(
                        "SYSTEM",
                        "HookedAfterRun",
                        `${command.name} - after`,
                    );
                    const hooked = hook.afterProc(res, args[0]);
                    if (isPromiseLike(hooked)) {
                        log.error(
                            "SYSTEM",
                            "HandlerError",
                            `Async hook cannot run in runSync: ${command.name}`,
                        );
                        throw new Error(
                            `Async hook cannot run in runSync: ${command.name}`,
                        );
                    }
                }
            }
        }
        log.info("SYSTEM", "RanSync", `Ran sync command-${command.name}`, {
            data: res,
        });
        return res as O;
    }
}
