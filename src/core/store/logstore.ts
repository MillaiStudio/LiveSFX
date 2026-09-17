import { defineStore } from "pinia";
import { ref } from "vue";

export const useLog = defineStore("log", () => {
    const log_stack = ref([]);
    return { log_stack };
});
