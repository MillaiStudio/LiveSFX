import { AnalysisTrackEvent, track } from "@/tracker";
import { Err } from "../types/types";
import Logo from "@/img/logo.png";
import { LogCategory, logger } from "../log/log";
import { generateUUID } from "./uuid";

export { generateUUID };

export const isPWA = (): boolean => {
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true
    );
};

export const onPanic = (e: unknown) => {
    window.dispatchEvent(new CustomEvent("panic", { detail: e }));
    try {
        track(AnalysisTrackEvent.Panic, {
            message: e,
        });
    } catch {
        //トラッキングのエラーは無視できる。
    }
};

export const applyGuard = (instance: object) => {
    const guarded = new Set<string>();
    let proto = Object.getPrototypeOf(instance);

    while (
        proto &&
        proto !== EventTarget.prototype &&
        proto !== Object.prototype
    ) {
        for (const key of Object.getOwnPropertyNames(proto)) {
            if (key === "constructor") continue;
            if (key.startsWith("_")) continue;
            if (guarded.has(key)) continue;

            const original = (instance as any)[key];

            if (typeof original !== "function") continue;
            guarded.add(key);

            (instance as any)[key] = (...args: any[]) => {
                const start = import.meta.env.DEV ? performance.now() : 0;
                try {
                    const result = original.apply(instance, args);

                    //Promise
                    if (result && typeof result.then === "function") {
                        return result
                            .then((result: unknown) => {
                                logger.debug(
                                    LogCategory.SYSTEM,
                                    "Done",
                                    `${key} tooks : ${performance.now() - start}ms`,
                                );
                                return result;
                            })
                            .catch((e: unknown) => {
                                onPanic(e);
                                logger.error(
                                    LogCategory.SYSTEM,
                                    "Error",
                                    "ProjectManager caught error",
                                    { data: { e } },
                                );
                                return Err(e);
                            });
                    }

                    logger.debug(
                        LogCategory.SYSTEM,
                        "Done",
                        `${key} tooks : ${performance.now() - start}ms`,
                    );

                    return result;
                } catch (e) {
                    onPanic(e);
                    logger.error(
                        LogCategory.SYSTEM,
                        "Error",
                        "ProjectManager caught error",
                        { data: { e } },
                    );
                    return Err(e);
                }
            };
        }
        proto = Object.getPrototypeOf(proto);
    }
};

export const showFatalOverlay = (detail?: unknown) => {
    if (document.getElementById("livesfx-fatal-overlay")) return;

    if (import.meta.env.DEV) console.error("Fatal error:", detail);

    const overlay = document.createElement("div");
    overlay.id = "livesfx-fatal-overlay";
    overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;display:flex;" +
        "flex-direction:column;gap:12px;align-items:center;justify-content:center;" +
        "background:rgba(28,28,30,0.92);color:#eee;text-align:center;padding:24px;" +
        "font-family:system-ui,sans-serif;";

    const message = document.createElement("p");
    message.style.cssText = "font-size:15px;max-width:24rem;margin:0;";
    message.textContent =
        "予期しないエラーが発生しました。セッションを保護するため、操作を続ける前に再読み込みしてください。";

    const button = document.createElement("button");
    button.textContent = "再読み込み";
    button.style.cssText =
        "background:#0091ff;color:#eee;border:none;border-radius:12px;" +
        "padding:10px 24px;font-size:15px;cursor:pointer;";
    button.onclick = () => window.location.reload();

    overlay.appendChild(message);
    overlay.appendChild(button);
    document.body.appendChild(overlay);
};
