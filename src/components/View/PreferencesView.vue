<script setup lang="ts">
import {
    computed,
    ref,
    onMounted,
    onBeforeUnmount,
    nextTick,
    watch,
} from 'vue';

import Tab, { type TabItem } from '../Tab.vue';

import General from './PrefView/general.vue';
import Sounds from './PrefView/sounds.vue';
import Mixer from './PrefView/mixer.vue';
import SideCar from './PrefView/sidecar.vue';

const selectedView = ref('general');

const tabItem = computed<TabItem[]>(() => [
    { id: 'general', label: '一般' },
    { id: 'sound', label: 'サウンド' },
    { id: 'mixer', label: 'ミキサー' },
    { id: 'sidecar', label: 'SideCar' },
]);

const contentRef = ref<HTMLElement>();
const containerHeight = ref(0);

let resizeObserver: ResizeObserver | null = null;

const observeCurrentHeight = async () => {
    await nextTick();
    if (!contentRef.value) return;
    resizeObserver?.disconnect();
    resizeObserver = new ResizeObserver(([entry]) => {
        if (entry)
            containerHeight.value = entry.contentRect.height;
    });
    resizeObserver.observe(contentRef.value);
    containerHeight.value = contentRef.value.offsetHeight;
};

watch(selectedView, observeCurrentHeight);

onMounted(() => {
    observeCurrentHeight();
});

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
});
</script>

<template>
    <div>
        <Tab :tabs="tabItem" v-model="selectedView" />

        <div class="settings-container" :style="{ height: `${containerHeight}px` }">
            <div ref="contentRef">
                <General v-if="selectedView === 'general'" />
                <Sounds v-else-if="selectedView === 'sound'" />
                <Mixer v-else-if="selectedView === 'mixer'" />
                <SideCar v-else-if="selectedView === 'sidecar'" />
            </div>
        </div>
    </div>
</template>

<style scoped>
.settings-container {
    overflow: hidden;
    transition: height 500ms ease-in-out;
}
</style>
