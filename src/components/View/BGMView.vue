<script setup lang="ts">
import { ref, useTemplateRef, onMounted, defineAsyncComponent } from 'vue';
import DeckPlayer from '../deckPlayer.vue';
import Settinglist from '../settinglist.vue';
import SettingsRow from '../settingsRow.vue';
import SettingsSection from '../settingsSection.vue';
import { useEngineState } from '@/core/store/enginestore.ts';
import { ProjectManager } from '@/core/index.ts';
import { EngineCommands } from '@/core/audioEngine/commands.ts';
import Modal from '../Modal.vue';
import Spinner from '../Spinner.vue';
import { EngineEvent } from '@/core/types/types.ts';
import { useUiState } from '@/core/store/ui_state.ts';

const store = useEngineState();
const ui_store = useUiState();
let dragging = ref(false);
const BGMEditor = defineAsyncComponent({
    loader: () => import('../View/BGMEditor.vue'),
    loadingComponent: Spinner
})

const calcColour = (v: number) => {
    const t = v / 100

    const indigo = { r: 109, g: 124, b: 255 }
    const yellow = { r: 255, g: 214, b: 0 }

    const r = Math.round(indigo.r + (yellow.r - indigo.r) * t)
    const g = Math.round(indigo.g + (yellow.g - indigo.g) * t)
    const b = Math.round(indigo.b + (yellow.b - indigo.b) * t)

    return `rgb(${r}, ${g}, ${b})`
}
const crossfade = useTemplateRef("crossfader")
const thumbColour = ref(calcColour(50))


const applyCrossfade = (position: number) => {
    const p = Math.min(Math.max(position, 0), 100) / 100
    const theta = p * (Math.PI / 2)
    const gainA = Math.cos(theta)
    const gainB = Math.sin(theta)

    ProjectManager.run(EngineCommands.set_gain, { id: "deckA", gain: gainA, initialised: true })
    ProjectManager.run(EngineCommands.set_gain, { id: "deckB", gain: gainB, initialised: true })
}

ProjectManager.addEventListener(EngineEvent.CrossFaded, (e: CustomEventInit<number>) => {
    if (store.sidecar_mode == undefined && e.detail === null) return
    const local_gain = ProjectManager.get_gain('deckA')
    if (!crossfade.value || (e.detail == undefined && store.sidecar_mode == 'visitor')) return
    if (e.detail !== undefined && e.detail !== null) {
        const theta = Math.acos(e.detail);
        crossfade.value.value = String(theta / (Math.PI / 2) * 100)
    } else if (local_gain.ok && crossfade.value) {
        const theta = Math.acos(local_gain.value);
        crossfade.value.value = String(theta / (Math.PI / 2) * 100)
    }
    thumbColour.value = calcColour(Number(crossfade.value.value))
})

const update = (value?: number) => {
    if (crossfade.value?.value !== undefined) {
        const position = value ?? crossfade.value.value;
        thumbColour.value = calcColour(Number(position))
        applyCrossfade(Number(position))
    }
}

onMounted(() => {
    if (crossfade.value) {
        crossfade.value.value = "50"
        update()
    }
    applyCrossfade(50)
})

const load_to_deck = (deckId: "deckA" | "deckB", bgmId: string) => {
    ProjectManager.run(EngineCommands.load_bgm_to_deck, { id: deckId, bgmId });
}

const showed_editor = ref(false);
const target_id = ref()
const filename = ref();

const show_editor = (id: string) => {
    const lib = ProjectManager.get_bgm_library();
    const targtet = lib[id]
    if (!targtet) return;
    target_id.value = targtet.id;
    filename.value = targtet.filename;
    showed_editor.value = true;
}

const mouse_to_value = (clientX: number) => {
    const target = crossfade.value;
    if (!target) return
    const rect = target.getBoundingClientRect();
    const width = rect.width;
    const x = clientX - rect.left
    const clampedX = Math.min(Math.max(x, 0), width)
    const value = (clampedX / width) * 100;
    target.value = String(value)
    update(value)
}

const onpointerdown = (e: PointerEvent) => {
    const targtet = crossfade.value
    dragging.value = true;
    if (!targtet) return
    targtet.setPointerCapture(e.pointerId);
    mouse_to_value(e.clientX)
}
const onmove = (e: PointerEvent) => {
    if (!dragging.value) return
    mouse_to_value(e.clientX)
}
const onPointerUp = (e: PointerEvent) => {
    dragging.value = false
    const targtet = crossfade.value
    if (!targtet) return
    targtet.releasePointerCapture(e.pointerId)
}
</script>
<template>
    <div style="padding: 12px;">
        <div class="container">
            <div class="grid">
                <DeckPlayer deck-id="deckA" colour="indigo" :deck_info="store.deck[0]" />
                <DeckPlayer deck-id="deckB" colour="yellow" :deck_info="store.deck[1]" />
            </div>
            <br>
            <input ref="crossfader" type="range" style="width: 100%; height: 2rem; touch-action: none;"
                :style="{ '--thumb-colour': thumbColour }" :class="{ dragging }" @input="update()"
                @pointerdown="onpointerdown" @pointermove="onmove" @pointerup="onPointerUp">
        </div>
        <div style="background-color: var(--gray-5);
        padding: 12px 0; margin: 12px; border-radius: 12px;">
            <Settinglist>
                <SettingsSection title="曲一覧">
                    <div v-if="store.bgm_library.length == 0"
                        style="background-color: var(--gray-5); width: 100%; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 12px;">
                        <p>曲がまだありません。</p>
                        <button @click="ProjectManager.add_bgm()"
                            v-if="store.sidecar_mode !== 'visitor'">曲を追加する</button>
                        <p v-else>ホストから曲を追加してください。</p>
                    </div>
                    <SettingsRow v-for="value in store.bgm_library" :label="value.filename" :key="value.id"
                        :chevron="ui_store.ui_mode == 'edit'" @click="show_editor(value.id)">
                        <div class="row-actions" v-show="ui_store.ui_mode == 'live'">
                            <button @click="load_to_deck('deckA', value.id)">A</button>
                            <button @click="load_to_deck('deckB', value.id)">B</button>
                        </div>
                    </SettingsRow>
                </SettingsSection>
            </Settinglist>
        </div>

        <Modal :show="showed_editor" @close="showed_editor = false">
            <BGMEditor :filaname="filename" :id="target_id" @saved="showed_editor = false" />
        </Modal>
    </div>
</template>
<style scoped>
.container {
    padding: 12px;
}

.grid {
    display: grid;
    gap: 12px;
    grid-template-columns: 1fr 1fr;
}

.flex {
    gap: 12px;
}

.flex>button {
    flex: 1;
    width: 4rem;
}

.row-actions {
    display: flex;
    gap: 6px;
}

.row-actions>button {
    width: 2rem;
}

input[type="range"] {
    appearance: none;
    background-color: var(--gray-5);
    border-radius: 12px;
}

input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    background-color: var(--thumb-colour);
    aspect-ratio: 2 / 1;
    height: 2rem;
    border-radius: 12px;
}
</style>
