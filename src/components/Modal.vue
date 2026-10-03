<script setup lang="ts">
import { useConfigStore } from '@/core/store/configstore';
import { Transition, useTemplateRef } from 'vue';
import { X } from '@lucide/vue';
const store = useConfigStore();

const emit = defineEmits(['close'])

const props = defineProps<{ title?: string, show: boolean, fixed_size?: boolean }>()
const outer = useTemplateRef('outer')
const clicked = (e: MouseEvent) => {
    const clicked_outer = outer.value == e.target
    if (clicked_outer) emit('close')
}
</script>
<template>
    <Transition :css="store.modalAnimation">
        <div class="full" v-if="props.show" @click="e => clicked(e)" ref="outer">
            <div class="dialog" :class="{ fixed_size: fixed_size }">
                <header>
                    <div>
                        <h3>{{ props.title }}</h3>
                    </div><button @click="$emit('close')">
                        <X />
                    </button>
                </header>
                <slot />
            </div>
        </div>
    </Transition>
</template>
<style scoped>
.full {
    position: fixed;
    inset: 0;
    z-index: 999;
    background-color: rgba(136, 136, 136, 0.452);
    display: flex;
    justify-content: center;
    align-items: center;
}

header {
    display: flex;
    position: sticky;
    background-color: var(--gray-5);
    z-index: 999;
    top: 0;
    transform: translateY(-7px);
    padding-top: 7px;

    div {
        padding-left: 20px;
        flex: 1;
        text-align: left;
    }

    button {
        flex: 0
    }
}

.dialog {
    header {
        text-align: right;

        button {
            background-color: transparent;
            box-shadow: none;
            border: none;
        }
    }

    padding: 7px;
    border-radius: 12px;
    background-color: var(--gray-5);
    max-height:clamp(400px, 600px, 100svh);
    width: clamp(600px, 800px, 100vw);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

.fixed_size {
    height: clamp(400px, 600px, 100svh);
}

.v-enter-active,
.v-leave-active {
    transition: background-color .2s ease-out;
}

.v-enter-from,
.v-leave-to {
    background-color: rgba(136, 136, 136, 0);
}

.v-enter-active .dialog,
.v-leave-active .dialog {
    transition: transform .2s ease-out;
}

.v-enter-from .dialog {
    transform: scale(0.8);
}

.v-leave-to .dialog {
    transform: scale(0.5);
    opacity: 0;
}

.v-enter-to .dialog,
.v-leave-from .dialog {
    transform: scale(1);
}
</style>
