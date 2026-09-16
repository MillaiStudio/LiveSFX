<script setup lang="ts">
import type { Notificatin } from '@/core/store/enginestore_type';
import { useNotifState } from '@/core/store/notif';
import { CircleQuestionMark, Info, ShieldAlert, Skull } from '@lucide/vue';

const props = defineProps<Notificatin>()
const store = useNotifState()

function handleClick() {
    store.dismissNotif(props.id);
    if (props.onClick)
        props.onClick();
}
</script>
<template>
    <div class="notification-container" @click="handleClick()">
        <div class="icon">
            <ShieldAlert v-if="props.type == 'warn'" color="var(--label-warn)" :size="32" />
            <Info v-else-if="props.type == 'info'" color="var(--label-accent)" :size="32" />
            <Skull v-else-if="props.type == 'critical'" color="var(--label-danger)" :size="32" />
            <CircleQuestionMark v-else :size="32" color="var(--label-boring)" />
        </div>
        <section>
            <h2>{{ props.title }}</h2>
            <p>{{ props.message }}</p>
        </section>
    </div>
</template>
<style scoped>
.notification-container {
    box-shadow: 1px 1px 4px 0px var(--gray-6);
    background-color: var(--blur);
    backdrop-filter: blur(42px);
    -webkit-backdrop-filter: blur(42px);
    padding: 12px;
    border-radius: 12px;
    display: flex;
    gap: 7px;
    pointer-events: all;
}


.notification-container.clickable:active {
    opacity: 0.8;
}

.icon {
    display: flex;
    align-items: center;
}
</style>
