export interface HookContext<I> {
    input: I;
    prevent: () => void;
}

export interface Hook<I = any, O = any> {
    beforeProc?: (ctx: HookContext<I>) => void | Promise<void>;
    afterProc?: (result: O, input: I) => void | Promise<void>;
}

// Executor.runSync で実行する同期コマンド用のhook。
// Promiseを返すhookは同期経路では使えないため、戻り値はvoidのみとする。
export interface SyncHook<I = any, O = any> {
    beforeProc?: (ctx: HookContext<I>) => void;
    afterProc?: (result: O, input: I) => void;
}
