import { defineStore } from "pinia";
import { ref } from "vue";
import { ProjectManager } from "..";
import { EngineEvent } from "../types/types";
import { type Notificatin } from "./notif_type";
import { errorMessages } from "./error_messages";
import { EngineError, EngineException } from "../types/error_types";
import { generateUUID } from "../util/util";

export const useNotifState = defineStore("notif", () => {
    const notif_queue = ref<Notificatin[]>([]);

    ProjectManager.addEventListener(EngineEvent.Error, (e) => {
        const event = e as CustomEvent<{
            type: EngineError | EngineException | string;
        }>;
        const id = generateUUID();
        const type = event.detail.type;

        const message =
            type in errorMessages
                ? errorMessages[type as EngineError | EngineException]
                : type;

        const restart = async () => {
            await ProjectManager.export();
            location.reload();
        };
        const onClick = type == "panic" ? restart : () => dismissNotif(id);
        notif_queue.value.push({
            id,
            type: "critical",
            title: "エラーが発生しました",
            message: message,
            onClick,
        });
        setTimeout(() => {
            const index = notif_queue.value.findIndex((v) => id === v.id);

            if (index !== -1) {
                notif_queue.value.splice(index, 1);
            }
        }, 1000);
    });

    const dismissNotif = (id: string) => {
        const index = notif_queue.value.findIndex((v) => id === v.id);
        if (index !== -1) {
            notif_queue.value.splice(index, 1);
        }
    };

    return {
        dismissNotif,
        notif_queue,
    };
});

