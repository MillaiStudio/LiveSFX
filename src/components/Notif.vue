<script setup lang="ts">
import type { Notificatin } from '@/core/store/enginestore_type';
import { useNotifState } from '@/core/store/notif';

const props = defineProps<Notificatin>()
const store = useNotifState()

function handleClick() {
    if (!props.onClick) return;
    props.onClick();
    // クリックされた通知はその場で読まれたとみなし、一覧から消す
    store.dismissNotif(props.id);
}
</script>
<template>
    <div class="notification-container" :class="{ clickable: !!props.onClick }"
        :role="props.onClick ? 'button' : undefined" :tabindex="props.onClick ? 0 : undefined" @click="handleClick"
        @keydown.enter="handleClick">
        <!--実装が一通り終わったらアイコン追加-->
        <div class="icon"></div>
        <section>
            <h2>{{ props.title }}</h2>
            <p>{{ props.message }}</p>
        </section>
    </div>
</template>
<style scoped>
.notification-container {
    background-color: var(--blur);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: 12px;
    border-radius: 12px;
    display: flex;
    gap: 7px;
    /* 親.notif_listはpointer-events:noneで貫通させているため、要素単位で有効化する */
    pointer-events: auto;
}

.notification-container.clickable {
    cursor: pointer;
}

.notification-container.clickable:active {
    opacity: 0.8;
}
</style>
