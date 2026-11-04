<script setup lang="ts">
export interface TabItem {
    id: string;
    label: string;
    disabled?: boolean;
}

const selected = defineModel<string>({ required: true });

const props = defineProps<{
    tabs: TabItem[];
}>();

const select = (tab: TabItem) => {
    if (tab.disabled) return;
    selected.value = tab.id;
};
</script>

<template>
    <div class="container">
        <div class="tabs" :style="{ '--tab-count': tabs.length }">
            <button v-for="tab in tabs" :key="tab.id" class="tab" :class="{ active: selected === tab.id, disabled: tab.disabled }"
                :disabled="tab.disabled" @click="select(tab)">
                {{ tab.label }}
            </button>
            <div class="glider" :style="{
                transform: `translateX(${tabs.findIndex(t => t.id === selected) * 100}%)`
            }" />
        </div>
    </div>
</template>

<style scoped>
.container {
    display: flex;
    justify-content: center;
    width: 100%;
}

.tabs {
    position: relative;
    display: flex;
    padding: 4px;
    border-radius: 12px;
    width: min(100%, calc(10rem * var(--tab-count) + 8px));
}

.tab {
    flex: 1;
    min-width: 0;
    z-index: 1;
    border: none;
    background: transparent;
    padding: 10px 16px;
    cursor: pointer;
    border-radius: 8px;
    font: inherit;
    transition: color 0.2s;
    color: var(--label-boring);

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tab.active {
    color: var(--label-normal);
}

.tab.disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.glider {
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 4px;
    width: calc((100% - 8px) / var(--tab-count));
    background-color: var(--blur);
    border-radius: 8px;
    transition: transform 0.25s ease;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
</style>
