<script setup lang="ts">
import { defineAsyncComponent, ref, reactive, computed, nextTick, watch } from 'vue';
import { ProjectManager } from '../../core/index.ts';
import { useEngineState } from '../../core/store/enginestore.ts';
import { useConfigStore } from '../../core/store/configstore.ts';
import Modal from '../Modal.vue';

import { UNGROUPED } from '@/core/constants.ts';
import { useUiState } from '@/core/store/ui_state.ts';

const selectedSound = ref();
const store = useEngineState();
const config = useConfigStore();
const ui_store = useUiState();

const editor = defineAsyncComponent({
    loader: () => import('./SoundEditor.vue'),
})

const order = ref<string[]>(store.sfx_library.map(s => s.id));

watch(
    () => store.sfx_library.map(s => s.id),
    (ids) => {
        if (dragState.id !== null) return;
        order.value = ids;
    }
);

const soundsById = computed(() => {
    const map = new Map();

    for (const s of store.sfx_library) {
        map.set(s.id, {
            filename: s.filename,
            group: s.group,
            sound: s,
        });
    }

    return map;
});

const groupNames = computed(() => store.groupNames.filter(v => v !== "BGM"))

const dragOverrideGroup = ref<string | null>(null);

const groupOf = (id: string) => {
    if (id === dragState.id && dragOverrideGroup.value !== null) {
        return dragOverrideGroup.value;
    }
    return soundsById.value.get(id)?.group || UNGROUPED;
};

const groupedOrder = computed(() => {
    const map = new Map<string, string[]>();
    for (const name of groupNames.value) map.set(name, []);
    for (const id of order.value) {
        const g = groupOf(id);
        if (!map.has(g)) map.set(g, []);
        map.get(g)!.push(id);
    }
    return map;
});

const cardRefs = new Map<string, HTMLElement>();
const setCardRef = (id: string, el: Element | { $el: Element } | null) => {
    if (!el) {
        cardRefs.delete(id);
        return;
    }
    const node = el instanceof Element ? el : el.$el;
    if (node instanceof HTMLElement) {
        cardRefs.set(id, node);
    }
}
// ドラッグしきい値・入れ替えしきい値・クールダウンは環境設定(一般タブ)で変更できる
let lastSwapAt = 0;

const dragState = reactive<{
    id: string | null;
    active: boolean;
    hasDragged: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    dx: number;
    dy: number;
}>({
    id: null,
    active: false,
    hasDragged: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
});

let dragOriginRect: DOMRect | null = null;

const ghostStyle = computed(() => {
    if (!dragState.active || !dragOriginRect) return {};
    return {
        position: 'fixed' as const,
        left: `${dragOriginRect.left + dragState.dx}px`,
        top: `${dragOriginRect.top + dragState.dy}px`,
        width: `${dragOriginRect.width}px`,
        height: `${dragOriginRect.height}px`,
        transform: 'scale(1.06)',
        pointerEvents: 'none' as const,
        zIndex: 999,
    };
});

const resetDragState = () => {
    dragState.id = null;
    dragState.active = false;
    dragState.pointerId = null;
    dragState.dx = 0;
    dragState.dy = 0;
    dragOriginRect = null;
    dragState.hasDragged = false;
}

const onGridPointerDown = (e: PointerEvent) => {
    if (ui_store.ui_mode !== 'edit') return;
    if (dragState.id !== null) return;

    const cardEl = (e.target as HTMLElement)?.closest('[data-sound-id]');
    if (!cardEl) return;
    const id = cardEl.getAttribute('data-sound-id');
    if (!id) return;



    dragState.id = id;
    dragState.active = false;
    dragState.hasDragged = false;
    dragState.pointerId = e.pointerId;
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    dragState.dx = 0;
    dragState.dy = 0;

    dragOriginRect = cardEl.getBoundingClientRect();

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

const onGridPointerMove = (e: PointerEvent) => {
    if (dragState.id === null || e.pointerId !== dragState.pointerId) return;

    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    const draggedId = dragState.id;

    if (!dragState.active) {
        if (Math.hypot(dx, dy) < config.dragThreshold) return;
        dragState.active = true;
        dragState.hasDragged = true;
    }

    e.preventDefault();
    dragState.dx = dx;
    dragState.dy = dy;

    const hoveredEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-sound-id]');
    const hoveredId = hoveredEl?.getAttribute('data-sound-id');
    const now = performance.now();

    if (hoveredEl && hoveredId && hoveredId !== draggedId) {
        const draggedGroup = groupOf(draggedId);
        const hoveredGroup = groupOf(hoveredId);

        if (hoveredGroup !== draggedGroup) {
            if (now - lastSwapAt < config.swapCooldownMs) return;
            const fromIndex = order.value.indexOf(draggedId);
            const toIndex = order.value.indexOf(hoveredId);
            if (fromIndex === -1 || toIndex === -1) return;

            lastSwapAt = now;
            dragOverrideGroup.value = hoveredGroup;
            reorderWithFlip(fromIndex, toIndex, draggedId);
            return;
        }

        const fromIndex = order.value.indexOf(draggedId);
        const toIndex = order.value.indexOf(hoveredId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
        if (now - lastSwapAt < config.swapCooldownMs) return;

        const hoveredRect = hoveredEl.getBoundingClientRect();
        const centerX = hoveredRect.left + hoveredRect.width / 2;
        const centerY = hoveredRect.top + hoveredRect.height / 2;
        const halfW = (hoveredRect.width / 2) * config.swapInnerRatio;
        const halfH = (hoveredRect.height / 2) * config.swapInnerRatio;
        if (Math.abs(e.clientX - centerX) > halfW || Math.abs(e.clientY - centerY) > halfH) {
            return;
        }

        lastSwapAt = now;
        reorderWithFlip(fromIndex, toIndex, draggedId);
        return;
    }


    const hoveredGridEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-group-name]');
    const hoveredGroupName = hoveredGridEl?.getAttribute('data-group-name');
    if (!hoveredGroupName || hoveredGroupName === groupOf(draggedId)) return;
    if (now - lastSwapAt < config.swapCooldownMs) return;

    const fromIndex = order.value.indexOf(draggedId);
    if (fromIndex === -1) return;

    lastSwapAt = now;
    dragOverrideGroup.value = hoveredGroupName;
    reorderToEnd(fromIndex, draggedId);
}

const finishDrag = async (committed: boolean) => {
    const id = dragState.id;
    const wasActive = dragState.active;
    const newGroup = dragOverrideGroup.value;

    if (!committed || id === null) {
        order.value = store.sfx_library.map(s => s.id);
        dragOverrideGroup.value = null;
        resetDragState();
        return;
    }

    const finalIndex = order.value.indexOf(id);
    resetDragState();

    if (wasActive && finalIndex !== -1) {
        if (newGroup !== null) {
            const groupResult = ProjectManager.move_sound_to_group(
                id, newGroup,
            );
            if (!groupResult.ok) {
                order.value = store.sfx_library.map(s => s.id);
                dragOverrideGroup.value = null;
                return;
            }
        }
        const result = await ProjectManager.move_sound(id, finalIndex);
        if (!result.ok) {
            order.value = store.sfx_library.map(s => s.id);
        }
    }
    dragOverrideGroup.value = null;
}

const onGridPointerUp = async (e: PointerEvent) => {
    if (Math.hypot(dragState.dx, dragState.dy) < config.dragThreshold && dragState.id) {
        onClick(dragState.id)
    }
    if (dragState.id === null || e.pointerId !== dragState.pointerId) return;
    await finishDrag(true);
}

const onGridPointerCancel = (e: PointerEvent) => {
    if (dragState.id === null || e.pointerId !== dragState.pointerId) return;
    void finishDrag(false);
}

const onGridLostPointerCapture = (e: PointerEvent) => {
    if (dragState.id === null || e.pointerId !== dragState.pointerId) return;
    void finishDrag(false);
}

const reorderWithFlip = async (fromIndex: number, toIndex: number, draggedId: string) => {
    const firstRects = new Map<string, DOMRect>();
    for (const [id, el] of cardRefs) {
        if (id === draggedId) continue;
        firstRects.set(id, el.getBoundingClientRect());
    }

    const next = order.value.slice();
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved as string);
    order.value = next;

    await nextTick();

    if (dragState.id !== draggedId) return;

    for (const [id, el] of cardRefs) {
        if (id === draggedId) continue;
        const first = firstRects.get(id);
        if (!first) continue;
        const last = el.getBoundingClientRect();
        const deltaX = first.left - last.left;
        const deltaY = first.top - last.top;
        if (deltaX === 0 && deltaY === 0) continue;

        el.style.transition = 'none';
        el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        requestAnimationFrame(() => {
            el.style.transition = 'transform 0.25s ease-out';
            el.style.transform = '';
        });
    }
}

const reorderToEnd = async (fromIndex: number, draggedId: string) => {
    const firstRects = new Map<string, DOMRect>();
    for (const [id, el] of cardRefs) {
        if (id === draggedId) continue;
        firstRects.set(id, el.getBoundingClientRect());
    }

    const next = order.value.slice();
    next.splice(fromIndex, 1);
    next.push(draggedId);
    order.value = next;

    await nextTick();

    if (dragState.id !== draggedId) return;

    for (const [id, el] of cardRefs) {
        if (id === draggedId) continue;
        const first = firstRects.get(id);
        if (!first) continue;
        const last = el.getBoundingClientRect();
        const deltaX = first.left - last.left;
        const deltaY = first.top - last.top;
        if (deltaX === 0 && deltaY === 0) continue;

        el.style.transition = 'none';
        el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        requestAnimationFrame(() => {
            el.style.transition = 'transform 0.25s ease-out';
            el.style.transform = '';
        });
    }
}

const onClick = async (id: string) => {
    if (dragState.hasDragged) {
        dragState.hasDragged = false;
        return;
    }
    const is_live = ui_store.ui_mode == "live";
    if (is_live) {
        await ProjectManager.play(id)
    } else {
        selectedSound.value = id;
    }
}

// --- グループ管理 ---
const showCreateGroup = ref(false);
const newGroupName = ref('');
const createGroupError = ref('');

const openCreateGroup = () => {
    newGroupName.value = '';
    createGroupError.value = '';
    showCreateGroup.value = true;
}

const submitCreateGroup = () => {
    const name = newGroupName.value.trim();
    if (!name) {
        createGroupError.value = 'グループ名を入力してください';
        return;
    }
    if (name === UNGROUPED || groupNames.value.includes(name)) {
        createGroupError.value = 'そのグループ名は既に使われています';
        return;
    }
    const result = ProjectManager.create_group(name);
    if (!result.ok) {
        createGroupError.value = result.value;
        return;
    }
    showCreateGroup.value = false;
}

const groupLabel = (name: string) => name === UNGROUPED ? '未分類' : name;

const deleteGroup = (name: string) => {
    if (name === UNGROUPED) return;
    if (!confirm(`グループ「${name}」を削除しますか?中の音は未分類に移動します。`)) return;
    ProjectManager.delete_group(name);
}

const renameGroup = (name: string) => {
    if (name === UNGROUPED) return;
    const input = window.prompt('新しいグループ名', name);
    if (input === null) return;
    const trimmed = input.trim();
    if (!trimmed || trimmed === name) return;
    if (trimmed === UNGROUPED || groupNames.value.includes(trimmed)) {
        alert('そのグループ名は既に使われています');
        return;
    }
    ProjectManager.rename_group(name, trimmed);
}
</script>

<template>
    <div>
        <div class="group-toolbar" v-if="ui_store.ui_mode === 'edit'">
            <button @click="openCreateGroup">＋ 新しいグループ</button>
        </div>
        <div v-for="groupName in groupNames" :key="groupName" class="group-section">
            <div class="group-header" v-if="groupedOrder.get(groupName)?.length || (ui_store.ui_mode === 'edit')">
                <h4>{{ groupLabel(groupName) }}</h4>
                <template v-if="groupName !== UNGROUPED && ui_store.ui_mode === 'edit'">
                    <button class="rename-group" @click="renameGroup(groupName)">名前を変更</button>
                    <button class="delete-group" @click="deleteGroup(groupName)">グループを削除</button>
                </template>
            </div>
            <div class="grid" :data-group-name="groupName" :class="{
                'empty-dropzone': ui_store.ui_mode === 'edit' && !groupedOrder.get(groupName)?.length,
            }" @pointerdown="onGridPointerDown" @pointermove="onGridPointerMove" @pointerup="onGridPointerUp"
                @pointercancel="onGridPointerCancel" @lostpointercapture="onGridLostPointerCapture">
                <button v-for="id in groupedOrder.get(groupName)" :key="id" :data-sound-id="id"
                    :ref="(el) => setCardRef(id, el as Element)" @click="onClick(id)"
                    :class="{ 'edit-mode': ui_store.ui_mode === 'edit' }">
                    <div class="card" :class="{
                        vibrate: ui_store.ui_mode === 'edit' && dragState.id !== id,
                        'is-dragging-source': dragState.id === id,
                        playing: store.playing_sfx.findIndex(v => v == id) >= 0
                    }">
                        <h3>{{ soundsById.get(id)?.filename }}</h3>
                    </div>
                </button>
            </div>
        </div>
        <Teleport to="body">
            <div v-if="dragState.active && dragState.id" class="drag-ghost card" :style="ghostStyle">
                <h3>{{ soundsById.get(dragState.id)?.filename }}</h3>
            </div>
        </Teleport>

        <Modal :show="selectedSound !== undefined" @close="selectedSound = undefined"
            :title="store.sfx_library.find(v => v.id == selectedSound)?.filename">
            <editor @saved="selectedSound = undefined" :sound-id="selectedSound" />
        </Modal>

        <Modal :show="showCreateGroup" @close="showCreateGroup = false" title="新しいグループ">
            <div class="create-group-form">
                <input type="text" v-model="newGroupName" placeholder="グループ名" @keydown.enter="submitCreateGroup">
                <p v-if="createGroupError" class="error">{{ createGroupError }}</p>
                <button @click="submitCreateGroup">作成</button>
            </div>
        </Modal>
    </div>
</template>

<style scoped>
.group-toolbar {
    padding: 12px 32px 0;
}

.group-section {
    margin-bottom: 8px;
}

.group-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 32px;
}

.group-header h4 {
    flex: 1;
    color: var(--label-boring);
}

.rename-group {
    font-size: 12px;
    color: var(--label-boring);
    background: transparent;
    border: none;
}

.delete-group {
    font-size: 12px;
    color: var(--label-danger);
    background: transparent;
    border: none;
}

.empty-dropzone {
    min-height: 72px;
    border-radius: 12px;
    box-shadow: inset 0 0 0 1px var(--gray-3);
}

.create-group-form {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 220px;
}

.create-group-form input {
    padding: 8px;
}

.create-group-form .error {
    color: var(--label-danger);
    font-size: 13px;
    margin: 0;
}

.grid button {
    background-color: transparent;
    border: none;
    padding: 0;
    touch-action: none;
}

.grid {
    display: grid;
    gap: 32px;
    padding: 32px;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.card {
    cursor: pointer;
    background-color: var(--gray-5);
    border-radius: 12px;
    padding: 12px;
    aspect-ratio: 1/1;
    transition: opacity .1s ease-in-out;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 12px rgba(0, 0, 0, 0.08), 0 12px 32px rgba(0, 0, 0, 0.06);
    transition: box-shadow .4s ease-in-out;
}

button:active .card {
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04), inset 0 4px 12px rgba(0, 0, 0, 0.08), inset 0 12px 32px rgba(0, 0, 0, 0.06);
}

.is-dragging-source {
    opacity: 0.25;
}

.edit-mode:nth-child(2n) .vibrate {
    animation: wobble-a 0.25s infinite;
    transform-origin: 50% 10%;
}

.edit-mode:nth-child(2n-1) .vibrate {
    animation: wobble-b 0.25s infinite alternate;
    transform-origin: 30% 5%;
}

.drag-ghost {
    background-color: var(--gray-5);
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08), 0 8px 20px rgba(0, 0, 0, 0.14), 0 20px 48px rgba(0, 0, 0, 0.1);
    box-sizing: border-box;
    display: flex;
    text-align: center;
}

.playing {
    box-shadow:
        0 0 20px var(--accent-fg),
        0 0 12px var(--red),
        0 0 20px var(--purple);
}
</style>

<style>
@keyframes wobble-a {
    0% {
        transform: rotate(-2deg);
        animation-timing-function: ease-in;
    }

    50% {
        transform: rotate(3deg);
        animation-timing-function: ease-out;
    }
}

@keyframes wobble-b {
    0% {
        transform: rotate(2deg);
        animation-timing-function: ease-in;
    }

    50% {
        transform: rotate(-3deg);
        animation-timing-function: ease-out;
    }
}
</style>
