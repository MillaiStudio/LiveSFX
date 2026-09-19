<script setup lang="ts">
import { useLog } from '@/core/store/logstore';

const { log_stack } = useLog();
</script>
<template>
    <div style="padding:0 12px;">
        <h2>ログ</h2>
        <section>
            <table>
                <tr v-for="value in log_stack" class="logline">
                    <td class="level" :class="value.level">{{ value.level }}</td>
                    <td class="cat">{{ value.category }}</td>
                    <td class="event">{{ value.event }}</td>
                    <td class="message">{{ value.message }}</td>
                    <td class="module">{{ value.module ?? '' }}</td>
                </tr>
            </table>
        </section>
    </div>
</template>
<style scoped>
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
</style>
