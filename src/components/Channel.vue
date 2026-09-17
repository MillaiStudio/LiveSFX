<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { useConfigStore } from '../core/store/configstore'

const props = defineProps<{ channelName: string, id: string, initial_gain?: number }>()

watch(props, () => {
    gain.value = props.initial_gain ?? 1
})

const gain = ref<number>(props.initial_gain ?? 1)
const emit = defineEmits<{ 'update:volume': [number], pointerUP: [number] }>()

const track = ref<HTMLElement | null>(null)
const thumbHeight = 60
const dragging = ref(false)

const config = useConfigStore()

const unityDb = 0

const channelName = ref(props.channelName.slice(0, props.channelName.lastIndexOf('.') < 0 ? undefined : props.channelName.lastIndexOf('.')))

const gainToDb = (g: number) => (g <= 0 ? -Infinity : 20 * Math.log10(g))
const dbToGain = (db: number) => (db <= config.faderMinDb ? 0 : Math.pow(10, db / 20))

const positionToDb = (pos: number) => {
    if (pos <= config.faderUnityPosition) {
        const t = pos / config.faderUnityPosition
        return config.faderMaxDb + (unityDb - config.faderMaxDb) * t
    } else {
        const t = (pos - config.faderUnityPosition) / (1 - config.faderUnityPosition)
        return unityDb + (config.faderMinDb - unityDb) * Math.pow(t, config.faderCurve)
    }
}

const dbToPosition = (db: number) => {
    if (db >= unityDb) {
        const t = (config.faderMaxDb - db) / (config.faderMaxDb - unityDb)
        return t * config.faderUnityPosition
    } else {
        const t = (unityDb - db) / (unityDb - config.faderMinDb)
        return config.faderUnityPosition + Math.pow(t, 1 / config.faderCurve) * (1 - config.faderUnityPosition)
    }
}

const thumbTop = computed(() => {
    const trackHeight = 300
    const range = trackHeight - thumbHeight
    const db = gainToDb(gain.value)
    const pos = db === -Infinity ? 1 : dbToPosition(Math.max(db, config.faderMinDb))
    return pos * range
})

const displayDb = computed(() => {
    if (gain.value <= 0) return '-∞'
    const db = gainToDb(gain.value)
    return (db >= 0 ? '+' : '') + db.toFixed(1)
})

const unityMarkTop = computed(() => {
    const trackHeight = 300
    const range = trackHeight - thumbHeight
    return config.faderUnityPosition * range + thumbHeight / 2
})

const positionToVolume = (clientY: number) => {
    if (!track.value) return gain.value
    const rect = track.value.getBoundingClientRect()
    const trackHeight = rect.height
    const range = trackHeight - thumbHeight
    const y = clientY - rect.top - thumbHeight / 2
    const clampedY = Math.min(Math.max(y, 0), range)
    const pos = clampedY / range
    const db = positionToDb(pos)
    return dbToGain(db)
}

const onPointerDown = (e: PointerEvent) => {
    dragging.value = true
        ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
    gain.value = positionToVolume(e.clientY);
    emit('update:volume', gain.value)
}

const onPointerMove = (e: PointerEvent) => {
    if (!dragging.value) return
    gain.value = positionToVolume(e.clientY)
    emit('update:volume', gain.value)
}

const onPointerUp = (e: PointerEvent) => {
    dragging.value = false
        ; (e.target as HTMLElement).releasePointerCapture(e.pointerId)
    emit('pointerUP', gain.value)
}

const onTrackClick = (e: PointerEvent) => {
    if (e.target === track.value) {
        gain.value = positionToVolume(e.clientY)
        emit('update:volume', gain.value)
    }
}

onUnmounted(() => {
    dragging.value = false
})
</script>

<template>
    <div class="channel">
        <div class="fader flex">
            <div class="track" ref="track" @pointerdown="onTrackClick">
                <div class="unityMark" :style="{ top: `${unityMarkTop}px` }"></div>
                <div class="fill" :style="{ height: `${300 - thumbTop}px` }"></div>
                <div class="thumb flex" :class="{ dragging }" :style="{ top: `${thumbTop}px` }"
                    @pointerdown.stop="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp"
                    @pointercancel="onPointerUp">
                    <div class="thumbGrip">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <div class="thumbCenterLine"></div>
                </div>
            </div>
            <span class="faderValue">{{ displayDb }}</span>
        </div>
        <div class="channeltitle">
            {{ channelName }}
        </div>
    </div>
</template>

<style scoped>
.channel {
    flex: 1;
    flex-shrink: 0
}

.fader {
    padding: 10px;
    justify-content: center;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}

.track {
    width: 10px;
    height: 300px;
    background-color: var(--gray-6);
    border-radius: 12px;
    position: relative;
    touch-action: none;
}

.unityMark {
    position: absolute;
    left: -4px;
    right: -4px;
    height: 2px;
    background-color: var(--gray-3);
    opacity: 0.6;
    pointer-events: none;
}

.fill {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: var(--gray-4);
    border-radius: 12px;
    pointer-events: none;
}

.thumb {
    position: absolute;
    width: 44px;
    height: 60px;
    left: -17px;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    touch-action: none;
    cursor: grab;

    background: linear-gradient(180deg,
            var(--gray-2) 0%,
            var(--gray-3) 46%,
            var(--gray-3) 54%,
            var(--gray-4) 100%);
    box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.35),
        inset 0 1px 0 rgba(255, 255, 255, 0.15),
        inset 0 -1px 0 rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(0, 0, 0, 0.2);

    transition: box-shadow 0.15s ease, transform 0.15s ease;
}

.thumb::before,
.thumb::after {
    content: "";
    position: absolute;
    left: 6px;
    right: 6px;
    height: 3px;
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.25);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08);
}

.thumb::before {
    top: 10px;
}

.thumb::after {
    bottom: 10px;
}

.thumbCenterLine {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 2px;
    transform: translateY(-50%);
    background-color: var(--gray-1);
}

.thumbGrip {
    display: none;
}

.thumb:active,
.thumb.dragging {
    cursor: grabbing;
    transform: scale(1.04);
    box-shadow:
        0 4px 10px rgba(0, 0, 0, 0.45),
        inset 0 1px 0 rgba(255, 255, 255, 0.2),
        inset 0 -1px 0 rgba(0, 0, 0, 0.3);
}

.faderValue {
    font-size: 10px;

    min-height: 12px;
}

.channeltitle {
    background-color: var(--gray-1);
    border-radius: 6px;
    text-align: center;
    width: 100%;
    text-wrap-mode: nowrap;
    white-space: nowrap;
    text-overflow: ellipsis;
    padding: 1px 6px;
    box-sizing: border-box;
    overflow: hidden;
}

.channel {
    padding: 10px;
    min-width: 100px;
}
</style>
