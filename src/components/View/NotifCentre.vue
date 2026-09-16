<script setup lang="ts">
import Notif from '../Notif.vue';
import { useNotifState } from '@/core/store/notif.ts';

const store = useNotifState();
</script>
<template>
    <div class="notif_list">
        <Notif v-for="(value) in store.notif_queue" :key="value.id" v-bind="value" />
    </div>
</template>
<style scoped>
.notif_list {
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
