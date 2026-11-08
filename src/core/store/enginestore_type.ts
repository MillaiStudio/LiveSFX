export const EngineProcState = {
    Idle: "idle",
    Loading: "loading",
    Writing: "writing",
    Proccessing: "proc",
    SomeTakesTooLong: "too_long",
} as const;

export type EngineProcState =
    (typeof EngineProcState)[keyof typeof EngineProcState];
