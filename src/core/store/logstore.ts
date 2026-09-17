import { defineStore } from "pinia";
import { ref } from "vue";
import { type Log } from "../log/log";

export const useLog = defineStore("log", () => {
    const log_stack = ref<Log[]>([]);
    return { log_stack };
});
