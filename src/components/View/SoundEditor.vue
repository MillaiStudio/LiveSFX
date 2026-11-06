<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { ProjectManager } from '../../core/index.ts';
import { useEngineState } from '../../core/store/enginestore.ts';
import { SFXPlayMode } from '@/core/audioEngine/sounds.ts';
import SettingsSection from '../settingsSection.vue';
import Settinglist from '../settinglist.vue';
import SettingsRow from '../settingsRow.vue';
import { UNGROUPED } from '@/core/constants.ts';
import { EngineCommands } from '@/core/audioEngine/commands.ts';

const props = defineProps<{ soundId: string }>();
const filename = ref();

const waveformEl = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);

const duration = ref(0);

const trimStart = ref(0);
const trimEnd = ref(0);

const dragging = ref<"start" | "end" | null>(null);
const MIN_GAP = 0.02;

const isPlaying = ref(false);
const activeSourceId = ref<string | null>(null);
let playResetTimer: number | null = null;

const playbackOption = ref<SFXPlayMode>(SFXPlayMode.OverLap);

const NEW_GROUP = '__new__';
const selectedGroup = ref<string>(UNGROUPED);
const newGroupName = ref('');
const groupError = ref('');

const groupOptions = computed(() =>
    ProjectManager.get_group_names().filter(g => g !== 'BGM')
);

const format_time = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
};

const timeLabel = computed(
    () => `${format_time(trimEnd.value - trimStart.value)} / ${format_time(duration.value)}`,
);

const startPct = computed(() => duration.value > 0 ? (trimStart.value / duration.value) * 100 : 0);
const endPct = computed(() => duration.value > 0 ? (trimEnd.value / duration.value) * 100 : 100);

const draw = () => {
    const el = canvas.value;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;

    el.width = width * dpr;
    el.height = height * dpr;

    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const peaks = ProjectManager.get_waveform(props.soundId, width);
    if (!peaks) return;

    const mid = height / 2;
    const style = getComputedStyle(el);
    ctx.strokeStyle = style.getPropertyValue('--label-accent') || '#0a84ff';
    ctx.lineWidth = 1;

    for (let x = 0; x < peaks.min.length; x++) {
        const min = peaks.min[x]
        const max = peaks.max[x]

        if (min == undefined) continue;
        if (max == undefined) continue;

        const y1 = mid + min * mid;
        const y2 = mid + max * mid;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, y1);
        ctx.lineTo(x + 0.5, y2);
        ctx.stroke();
    }
};

const load_sound = () => {
    stop_preview();
    const d = ProjectManager.get_duration(props.soundId) ?? 0;
    const meta = ProjectManager.get_soundinfo(props.soundId);
    playbackOption.value = meta?.play_mode ?? SFXPlayMode.OverLap;
    duration.value = d;
    trimStart.value = meta?.start_from ?? 0;
    trimEnd.value = meta?.end_at ?? d;
    selectedGroup.value = meta?.group ?? UNGROUPED;
    newGroupName.value = '';
    groupError.value = '';
    filename.value = meta?.filename;
    draw();
};

const clamp_trim = () => {
    trimStart.value = Math.min(Math.max(0, trimStart.value), duration.value);
    trimEnd.value = Math.min(Math.max(trimStart.value, trimEnd.value), duration.value);
};

const time_from_pointer = (clientX: number) => {
    if (!waveformEl.value || duration.value <= 0) return 0;
    const rect = waveformEl.value.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return fraction * duration.value;
};

const start_drag = (which: "start" | "end", evt: PointerEvent) => {
    evt.preventDefault();
    dragging.value = which;
    (evt.currentTarget as HTMLElement).setPointerCapture(evt.pointerId);
};

const on_drag_move = (evt: PointerEvent) => {
    if (!dragging.value) return;
    const time = time_from_pointer(evt.clientX);
    if (dragging.value === "start") {
        trimStart.value = Math.max(0, Math.min(time, trimEnd.value - MIN_GAP));
    } else {
        trimEnd.value = Math.min(duration.value, Math.max(time, trimStart.value + MIN_GAP));
    }
};

const end_drag = () => {
    dragging.value = null;
};

const stop_preview = () => {
    if (playResetTimer !== null) {
        window.clearTimeout(playResetTimer);
        playResetTimer = null;
    }
    if (activeSourceId.value) {
        ProjectManager.run(EngineCommands.stop, { source_id: activeSourceId.value });
        activeSourceId.value = null;
    }
    isPlaying.value = false;
};

const toggle_play = async () => {
    if (isPlaying.value) {
        stop_preview();
        return;
    }

    clamp_trim();
    const result = await ProjectManager.run(EngineCommands.play, {
        id: props.soundId, options: {
            start: trimStart.value,
            end: trimEnd.value,
        }
    });
    if (!result.ok) return;
    if (!('value' in result)) return;
    if (!result.value.played) return;
    activeSourceId.value = result.value.sourceID;
    isPlaying.value = true;

    const playMs = Math.max(0, trimEnd.value - trimStart.value) * 1000;
    playResetTimer = window.setTimeout(() => {
        activeSourceId.value = null;
        isPlaying.value = false;
        playResetTimer = null;
    }, playMs);
}

let resizeObserver: ResizeObserver | null = null;

watch(() => props.soundId, load_sound);

onMounted(() => {
    load_sound();
    resizeObserver = new ResizeObserver(() => draw());
    if (canvas.value) resizeObserver.observe(canvas.value);
});

onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    stop_preview();
});

const emit = defineEmits(['saved']);

const valid = ref(true)
const saving = ref(false)
const save = async () => {
    if (saving.value) return;
    saving.value = true;
    try {
        await ProjectManager.run(EngineCommands.trim, { id: props.soundId, start: trimStart.value, end: trimEnd.value });
        await ProjectManager.run(EngineCommands.set_sfx_play_mode, { id: props.soundId, mode: playbackOption.value });

        let targetGroup: string | undefined = selectedGroup.value || undefined;
        if (selectedGroup.value === NEW_GROUP) {
            const name = newGroupName.value.trim();
            if (!name) {
                groupError.value = 'グループ名を入力してください';
                return;
            }
            if (groupOptions.value.includes(name)) {
                groupError.value = 'そのグループ名は既に使われています';
                return;
            }
            const created = await ProjectManager.run(EngineCommands.create_group, { name });
            if (!created.ok) {
                groupError.value = created.value;
                return;
            }
            targetGroup = name;
        }

        const currentMeta = ProjectManager.get_soundinfo(props.soundId);
        if ((currentMeta?.group ?? undefined) !== targetGroup) {
            const result = await ProjectManager.run(EngineCommands.move_sound_to_group, { id: props.soundId, newGroup: targetGroup });
            if (!result.ok) {
                groupError.value = result.value;
                return;
            }
        }
        await ProjectManager.run(EngineCommands.rename, { id: props.soundId, name: filename.value });

        emit('saved');
    } finally {
        saving.value = false;
    }
}

const deleteSFX = () => {
    const decision = confirm("プロジェクトからファイルを削除しますか？");
    if (decision) {
        ProjectManager.run(EngineCommands.discard_sound, { id: props.soundId });
        emit('saved')
    }
}
</script>

<template>
    <div class="editor">
        <Settinglist>
            <SettingsSection title="トリミング">
                <div class="waveform" ref="waveformEl">
                    <canvas ref="canvas"></canvas>

                    <div class="trim-mask" :style="{ left: '0%', width: startPct + '%' }" />
                    <div class="trim-mask" :style="{ left: endPct + '%', width: (100 - endPct) + '%' }" />

                    <div class="handle" :style="{ left: startPct + '%' }" @pointerdown="start_drag('start', $event)"
                        @pointermove="on_drag_move" @pointerup="end_drag" @pointercancel="end_drag" />
                    <div class="handle" :style="{ left: endPct + '%' }" @pointerdown="start_drag('end', $event)"
                        @pointermove="on_drag_move" @pointerup="end_drag" @pointercancel="end_drag" />
                </div>

                <div class="transport">
                    <button class="play-button" @click="toggle_play">{{ isPlaying ? "■" : "▶" }}</button>
                    <span class="time">{{ timeLabel }}</span>

                    <div class="trim-readout">
                        <input class="trim-time" type="number" min="0" :max="trimEnd - MIN_GAP" step="0.01"
                            v-model.number="trimStart" @change="clamp_trim">
                        <span class="sep">–</span>
                        <input class="trim-time" type="number" :min="trimStart + MIN_GAP" :max="duration" step="0.01"
                            v-model.number="trimEnd" @change="clamp_trim">
                    </div>
                </div>
            </SettingsSection>
            <SettingsSection title="その他">
                <SettingsRow label="なまえ"><input type="text" v-model="filename" minlength="1"
                        @input="valid = !!filename">
                </SettingsRow>
                <SettingsRow label="再生中に再生ボタンを押したときの動作">
                    <select name="PlaybackOption" v-model="playbackOption">
                        <option :value="SFXPlayMode.OverLap">上書き再生</option>
                        <option :value="SFXPlayMode.Restart">再生しなおす</option>
                        <option :value="SFXPlayMode.Ignore">無視する</option>
                        <option :value="SFXPlayMode.Stop">とめる</option>
                    </select>
                </SettingsRow>
                <SettingsRow label="グループ">
                    <select name="GroupOption" v-model="selectedGroup">
                        <option v-for="g in groupOptions" :key="g" :value="g">{{ g == UNGROUPED ? '未分類' : g }}</option>
                    </select>
                </SettingsRow>
            </SettingsSection>
            <SettingsSection>
                <SettingsRow label="効果音を削除する" chevron danger @click="deleteSFX()"></SettingsRow>
            </SettingsSection>
        </Settinglist>
        <button @click="save()" :disabled="!valid || saving">変更を保存</button>
    </div>
</template>

<style scoped>
.editor {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.header h1 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 600;
}

.waveform {
    position: relative;
    min-height: 12rem;
    border-radius: 10px;
    background: var(--gray-6);
    overflow: hidden;
    touch-action: none;
}

.waveform canvas {
    width: 100%;
    height: 100%;
    display: block;
}

.trim-mask {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.55);
    pointer-events: none;
}

.handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 20px;
    margin-left: -10px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: ew-resize;
}

.handle::before {
    content: "";
    width: 3px;
    height: 100%;
    background: var(--label-accent);
    border-radius: 2px;
}

.handle::after {
    content: "";
    position: absolute;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--label-accent);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.transport {
    display: flex;
    align-items: center;
    gap: 12px;
}

.play-button {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 50%;
    border: none;
    background: var(--label-accent);
    color: var(--gray-6);
    font-size: 14px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.play-button:active {
    opacity: 0.7;
}

.time {
    font-variant-numeric: tabular-nums;
    color: var(--gray-1);
}

.trim-readout {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
}

.trim-time {
    width: 4.5rem;
    min-height: unset;
    border: none;
    background: transparent;
    color: inherit;
    font-variant-numeric: tabular-nums;
    text-align: right;
}

.trim-time:focus {
    outline: none;
    background: var(--gray-6);
    border-radius: 4px;
}

.sep {
    color: var(--gray-2);
}

.new-group-input {
    margin-top: 8px;
    padding: 6px 8px;
    width: 100%;
    box-sizing: border-box;
}

.group-error {
    color: var(--label-danger);
    font-size: 13px;
    margin: 6px 0 0;
}
</style>
