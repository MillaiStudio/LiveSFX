export interface HookContext<I> {
    input: I;
    prevent: () => void;
}

export interface Hook<I = any, O = any> {
    beforeProc?: (ctx: HookContext<I>) => void | Promise<void>;
    afterProc?: (result: O, input: I) => void | Promise<void>;
}
