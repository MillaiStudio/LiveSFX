<script setup lang="ts">
import { LogCategory, LogLevel } from '@/core/log/log';
import { useLog } from '@/core/store/logstore';
import { computed, reactive } from 'vue';

const { log_stack } = useLog();

const filter: Record<keyof typeof LogLevel | keyof typeof LogCategory, boolean> = reactive({
    DEBUG: false,
    INFO: true,
    WARN: true,
    ERROR: true,
    FATAL: true,
    NETWORK: true,
    SYSTEM: true,
    FILE: true,
    AUDIO: true,
    EVENT: true
})
const filterd = computed(() => {
    return log_stack.filter(
        v => filter[v.level] && filter[v.category]
    )
})
</script>
<template>
    <div style="padding:0 12px;">
        <h2>ログ</h2>
        <div>
            <strong>ログレベル</strong>
            <div style="flex">
                <span v-for="value in LogLevel" class="filter">
                    <input type="checkbox" :name="value" v-model="filter[value]">
                    <label :for="value" @click="filter[value] = !filter[value]">{{ value }}</label>
                </span>
            </div>
        </div>
        <div>
            <strong>カテゴリ</strong>
            <div style="flex">
                <span v-for="value in LogCategory" class="filter">
                    <input type="checkbox" :name="value" v-model="filter[value]">
                    <label :for="value" @click="filter[value] = !filter[value]">{{ value }}</label>
                </span>
            </div>
        </div>
        <section>
            <table>
                <TransitionGroup name="loglist" tag="tbody">
                    <tr v-for="value in filterd" class="logline" :key="value.id">
                        <td class="level" :class="value.level">{{ value.level }}</td>
                        <td class="cat">{{ value.category }}</td>
                        <td class="event">{{ value.event }}</td>
                        <td class="message">{{ value.message }}</td>
                        <td class="module">{{ value.module ?? '' }}</td>
                    </tr>
                </TransitionGroup>
            </table>
        </section>
    </div>
</template>
<style scoped>
.filter {
    label {
        margin-inline-start: 4px;
        cursor: pointer;
    }

    input {
        cursor: pointer;
    }
}

table {
    width: 100%;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0 7px;
}

.logline {
    td {
        line-height: 1rem;
        border-radius: 3px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding-inline: 7px;
    }

    .level {
        text-align: center;
        width: 5rem;
    }

    .cat {
        width: 6rem;
        color: var(--label-boring);
    }

    .event {
        width: 8rem;
    }
}

.INFO {
    background-color: var(--accent-bg);
}

.DEBUG {
    background-color: var(--gray-4);
}

.WARN {
    background-color: var(--orange);
}

.ERROR {
    background-color: var(--red);
}

.FATAL {
    background-color: var(--yellow);
    color: black;
}

.loglist-move,
.loglist-enter-active,
.loglist-leave-active {
    transition: all .35s ease-in-out;
}

.loglist-enter-from,
.loglist-leave-to {
    opacity: 0;
}

.loglist-leave-active {

    position: absolute;
}
</style>
