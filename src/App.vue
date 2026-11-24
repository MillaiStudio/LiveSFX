<script setup lang="ts">
import AppBar, { type MenuList } from './components/AppBar.vue';
import { ProjectManager, } from './core/index.ts';
import { useSideCarStore } from './core/store/sidecar_store.ts';
import NotifCentre from "./components/View/NotifCentre.vue";
import Spinner from "./components/Spinner.vue";
import { useProcState, EngineProcState } from "./core/store/procstore.ts";
import PadView from "./components/View/PadView.vue";
import Tab, { type TabItem } from "./components/Tab.vue";
import { computed, defineAsyncComponent, onMounted, ref, useTemplateRef } from 'vue';
import Modal from './components/Modal.vue';
import UpdateModal from './components/View/UpdateModal.vue';
import { useConfigStore } from './core/store/configstore.ts';
import { useUiState } from './core/store/ui_state.ts';
import { storeToRefs } from 'pinia';
import Loading from './components/loading.vue';

const footer_height = ref()
const footer = useTemplateRef('footer')
const MixerView = defineAsyncComponent({
    loader: () => import('./components/View/MixerView.vue'),
    loadingComponent: Loading
})
const BGMView = defineAsyncComponent({
    loader: () => import('./components/View/BGMView.vue'),
    loadingComponent: Loading
})
const prefView = defineAsyncComponent({
    loader: () => import('./components/View/PreferencesView.vue'),
    loadingComponent: Loading
})

const consentView = defineAsyncComponent({
    loader: () => import('./components/View/consent.vue'),
    loadingComponent: Loading
})

const Footer = defineAsyncComponent({
    loader: () => import('./components/Footer.vue')
})

const DragAndDropArea = defineAsyncComponent({
    loader: () => import('./components/View/DragFile.vue')
})
const engine_store = useProcState();
const sidecar_store = useSideCarStore();
const ui_store = useUiState();
const config_store = useConfigStore();
const menu = computed((): MenuList[] => {
    const from_new = {
        label: "新規", id: "new", handle: () => {
            ProjectManager.start_with_blank();
        }
    }
    const from_file =
        { label: "開く", id: "open", handle: () => { ProjectManager.start_from_file(); } }
    const saveas = { label: "名前を付けて保存", id: "save", handle: () => { ProjectManager.export(); } }
    const pref = {
        label: "環境設定", id: "pref", handle: () => {
            showPrefView.value = true;
        }
    }
    const disconnect = {
        label: 'SideCarを終了する',
        id: 'disconnect',
        handle: () => {
            const will = confirm('本当に切断しますか？');
            if (!will) return;
            ProjectManager.disconnect()
        }
    }
    const file = {
        label: "ファイル",
        id: 'file',
        children: [
            from_new, from_file, saveas, pref
        ]
    }
    const sound = {
        label: "サウンド",
        id: "sound",
        children: [
            { "label": "効果音の追加", id: "add", handle: () => { ProjectManager.add_sfx(); } },
            { "label": "BGMの追加", id: "add_bgm", handle: () => { ProjectManager.add_bgm(); } }
        ]
    }

    const sidecar = {
        label: 'SideCar',
        id: 'sidecar',
        children: [disconnect
        ]
    }
    let menu = []
    if (sidecar_store.sidecar_mode !== 'visitor') menu.push(file, sound)
    if (sidecar_store.sidecar_mode) menu.push(sidecar)
    return menu
})

const message: Record<EngineProcState, string> = {
    "idle": "",
    "loading": "読み込み中",
    "proc": "処理中",
    "too_long": "想定より長く時間がかかっています",
    "writing": "書き込み中"
}


const tabitems: TabItem[] = [{
    id: "pad",
    label: "Pad"
}, {
    id: "bgm",
    label: "BGM"
}, {
    id: "mixer",
    label: "ミキサー"
}]

const { tab } = storeToRefs(ui_store)
const selectedView = config_store.memoryLastTab
    ? tab
    : ref("pad")

const showPrefView = ref<boolean>(false);
const showConsentView = ref<boolean>(false);

onMounted(() => {
    ui_store.ui_mode = 'live'
    if (config_store.is_first) {
        config_store.is_first = false;
        showConsentView.value = true
    }
    const observer = new ResizeObserver(() => {
        footer_height.value = footer.value?.clientHeight ?? 0;
    })
    if (footer.value) observer.observe(footer.value)
})
</script>

<template>
    <main>
        <AppBar v-bind:items="menu" />
        <Tab :tabs="tabitems" v-model="selectedView" />
        <div class="view" :style="{ 'padding-bottom': footer_height + 'px' }">
            <PadView v-show="selectedView === 'pad'" />
            <BGMView v-show="selectedView === 'bgm'" />
            <!--ミキサーは少し重い操作がある可能性があるうえそんなに頻繁に使わないからv-ifで十分-->
            <MixerView v-if="selectedView === 'mixer'" />
        </div>
        <footer ref="footer">
            <Footer />
        </footer>

        <NotifCentre />
        <div class="full" v-if="engine_store.EngineState !== EngineProcState.Idle">
            <div class="spinner_container">
                <Spinner />
                <p>{{ message[engine_store.EngineState] }}</p>
            </div>
        </div>
        <Modal :show="showPrefView" @close="showPrefView = false">
            <prefView />
        </Modal>
        <Modal :show="showConsentView" @close="showConsentView = false">
            <consentView />
        </Modal>
        <UpdateModal />
        <DragAndDropArea />
    </main>
</template>

<style scoped>
main {
    width: 100vw;
    height: 100svh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
}

.full {
    position: fixed;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--blur);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);

}

.spinner_container {
    padding: 12px;
    gap: 12px;
    width: 15rem;
    aspect-ratio: 1;
    background-color: var(--gray-5);
    border-radius: 7px;
    justify-content: center;
    align-items: center;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    text-align: center;
}


footer {
    border-top: 1px solid var(--gray-5);
    position: fixed;
    bottom: 0;
    padding: 12px;
    left: 0;
    right: 0;
    background-color: var(--gray-6);
    background-color: var(--blur);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(18px);
}

.view {
    overflow-y: auto;
    flex: 1;
}
</style>
