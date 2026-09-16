<script setup lang="ts">
import Notif from '../Notif.vue';
import { useNotifState } from '@/core/store/notif.ts';

const store = useNotifState();
</script>
<template>
    <div class="notif-list">
        <TransitionGroup name="notif-list">
            <Notif v-for="value in store.notif_queue" :key="value.id" v-bind="value" />
        </TransitionGroup>
    </div>
</template>
<style scoped>
.notif-list-move,
.notif-list-enter-active,
.notif-list-leave-active {
    transition: all .35s ease-in-out;
}

.notif-list-enter-from,
.notif-list-leave-to {
    transform: translateX(100%);
}

.notif-list-leave-active {
    position: absolute;
}

.notif-list {
    position: fixed;
    width: 15rem;
    right: 12px;
    top: 64px;
    display: flex;
    gap: 12px;
    flex-direction: column;
    height: calc(100vh - 24px);
    overflow-y: auto;
    scrollbar-width: none;
    pointer-events: none;
}
</style>
