import { useConfigStore } from "../store/configstore";
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

let db: IDBDatabase | null = null;
let log_queue: Log[] = [];
let log_timer: number | undefined;
let db_init_promise: Promise<void> | null = null;

const init = async () => {
    db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("app_log", 1);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject("blocked");
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains("log")) {
                const store = db.createObjectStore("log", {
                    keyPath: "id",
                    autoIncrement: true,
                });

                store.createIndex("timestamp", "timestamp");
                store.createIndex("session_id", "session_id");
                store.createIndex("level", "level");
                store.createIndex("category", "category");
            }
        };
        request.onsuccess = () => resolve(request.result);
    });
};

const init_log_db = async () => {
    if (!db_init_promise) {
        db_init_promise = init().catch((e) => {
            db_init_promise = null;
            throw e;
        });
    }

    await db_init_promise;
};

const log_to_indexedDB = async (log: Log) => {
    if (!db) await init_log_db();
    log_queue.push(log);
    if (log_timer) clearTimeout(log_timer);
    log_timer = setTimeout(async () => {
        log_timer = undefined;
        const log = log_queue;
        log_queue = [];
        if (!db) await init_log_db();
        const transaction = db!.transaction(["log"], "readwrite");
        const obj_store = transaction.objectStore("log");
        for (const entry of log) {
            obj_store.add(entry);
        }
        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    }, 1000);
};

const log_to_store = (log: Log) => {
    const { log_stack } = useLog();
    const { maxLogEntries } = useConfigStore();
    while (log_stack.length >= maxLogEntries && log_stack.length > 0) {
        log_stack.shift();
    }
    if (maxLogEntries > 0) {
        log_stack.push(log);
    }
};

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
        const log: Log = {
            timestamp: Date.now(),
            event,
            session_id,
            level,
            category,
            message,
            ...option,
        };
        log_to_store(log);
        log_to_indexedDB(log);
        if (import.meta.env.DEV) console.debug(log);
        return log;
    },
};
