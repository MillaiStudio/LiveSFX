import type { Command } from "./commands";
import type { Hook } from "./hooks";

type Handler<I, O> = (input: I) => O | Promise<O>;

interface CommandProc<I, O> {
    hanlder: Handler<I, O>;
}

export class Executor {
    private handlers = new Map<string, CommandProc<any, any>>();
    private hooks = new Map<string, Hook>();

    set_hook(target: Command<any, any>, hook: Hook) {
        this.hooks.set(target.name, hook);
    }
    register<I, O>(command: Command<I, O>, proccess: CommandProc<I, O>): void {
        this.handlers.set(command.name, proccess);
    }
    async run<I, O>(command: Command<I, O>, input: I): Promise<O> {
        const proc = this.handlers.get(command.name);
        const hook = this.hooks.get(command.name);
        let run = true;
        let res;
        if (!proc || !proc.hanlder) {
            throw new Error(`Handler not registered: ${command.name}`);
        }
        if (hook?.beforeProc) res = hook.beforeProc(() => (run = false));
        if (run) res = await proc.hanlder(input);
        if (hook?.afterProc) res = hook.afterProc();
        return await res;
    }
}
