import { useLog } from "../store/logstore";
import { generateUUID } from "../util/util";

export const LogLevel = {
    DEBUG: "DEBUG",
    INFO: "INFO",
    WARN: "WARN",
    ERROR: "ERROR",
    FATAL: "FATAL",
} as const;
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export const LogCategory = {
    SYSTEM: "SYSTEM",
    FILE: "FILE",
    AUDIO: "AUDIO",
    EVENT: "EVENT",
};
export type LogCategory = (typeof LogCategory)[keyof typeof LogCategory];

export interface Log {
    id: string;
    timestamp: number;
    session_id: string;

    level: LogLevel;
    category: LogCategory;
    event: string;
    message: string;

    module?: string;
    data?: Record<string, unknown>;
    error?: unknown;
}
const session_id = generateUUID();
export const logger = {
    log: (
        level: LogLevel,
        category: LogCategory,
        event: string,
        message: string,
        option?: {
            module?: string;
            data?: Record<string, unknown>;
            error?: unknown;
        },
    ) => {
        const store = useLog();
        const log: Log = {
            id: generateUUID(),
            timestamp: Date.now(),
            event,
            session_id,
            level,
            category,
            message,
            ...option,
        };
        store.log_stack.push(log);
        if (import.meta.env.DEV) console.debug(log);
        return log;
    },
};
