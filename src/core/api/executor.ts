import type { Command } from "./commands";

type Handler<I, O> = (input: I) => O | Promise<O>;

interface CommandProc<I, O> {
    hanlder: Handler<I, O>;
}

export class Executor {
    private handlers = new Map<string, CommandProc<any, any>>();

    register<I, O>(command: Command<I, O>, proccess: CommandProc<I, O>): void {
        this.handlers.set(command.name, proccess);
    }

    async run<I, O>(command: Command<I, O>, input: I): Promise<O> {
        let run = true;
        let res;
        const proc = this.handlers.get(command.name);
        if (!proc || !proc.hanlder) {
            throw new Error(`Handler not registered: ${command.name}`);
        }
        if (run) res = await proc.hanlder(input);
        return await res;
    }
}
