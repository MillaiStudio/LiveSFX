import { AnalysisTrackEvent, track } from "@/tracker";
import { Err } from "../types/types";
import Logo from "@/img/logo.png";
import { LogCategory, logger } from "../log/log";

export const generateUUID = (): string => {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

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
export const gen_ios_splash = () => {
    if (
        (navigator as Navigator & { standalone?: boolean }).standalone === false
    ) {
        requestAnimationFrame(() => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement("canvas");

                const screenWidth = screen.width * devicePixelRatio;
                const screenHeight = screen.height * devicePixelRatio;

                const draw = ([canvasWidth, canvasHeight]: [
                    number,
                    number,
                ]): string => {
                    canvas.width = canvasWidth;
                    canvas.height = canvasHeight;

                    const ctx = canvas.getContext("2d");

                    if (!ctx) {
                        throw new Error("Failed to get canvas context");
                    }

                    const { width: imageWidth, height: imageHeight } = img;
                    const scale = Math.min(
                        canvasWidth / imageWidth,
                        canvasHeight / imageHeight,
                    );

                    ctx.drawImage(
                        img,
                        0,
                        0,
                        1,
                        1,
                        0,
                        0,
                        canvasWidth,
                        canvasHeight,
                    );

                    ctx.drawImage(
                        img,
                        0,
                        0,
                        imageWidth,
                        imageHeight,
                        (canvasWidth - imageWidth * scale) / 2,
                        (canvasHeight - imageHeight * scale) / 2,
                        imageWidth * scale,
                        imageHeight * scale,
                    );

                    return canvas.toDataURL();
                };

                const startupImages = [
                    [draw([screenWidth, screenHeight]), "portrait"],
                    [draw([screenHeight, screenWidth]), "landscape"],
                ] as const;

                document.head.insertAdjacentHTML(
                    "beforeend",
                    startupImages
                        .map(
                            ([href, orientation]) =>
                                `<link rel="apple-touch-startup-image" href="${href}" media="(orientation:${orientation})">`,
                        )
                        .join(""),
                );
            };

            img.src = Logo;
        });
    }
};
