import { defineStore } from "pinia";
import { ref } from "vue";
import { log_list, type Log } from "../log/log";

export const useLog = defineStore("log", () => {
    const log_stack = ref<Log[]>(log_list);
    window.addEventListener(
        "Logger:Logged",
        () => (log_stack.value = log_list),
    );
    return { log_stack };
});
