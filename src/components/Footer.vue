<script setup lang="ts">
import { ProjectManager } from '@/core';
import { useConfigStore } from '@/core/store/configstore';
import { useEngineState } from '@/core/store/enginestore';
import Toggle from './toggle.vue';
import { useUiState } from '@/core/store/ui_state.ts';
import { EngineCommands } from '@/core/audioEngine/commands.ts';

const configstore = useConfigStore();
const engine_store = useEngineState();
const ui_store = useUiState();

const toggle_ui_mode = () => {
    if (ui_store.ui_mode == "live") {
        const will = configstore.enterEditModeConfirm ? confirm('編集モードに入りますか?') : true;
        if (!will) return;
        ui_store.ui_mode = "edit"
    } else {
        ui_store.ui_mode = "live";
    }
}

const requestDucking = () => {
    ProjectManager.run(EngineCommands.ducking);
}
</script>
<template>
    <div class="flex" style="justify-content: space-between;">
        <button @click="ProjectManager.run(EngineCommands.stop_all_sfx)">すべての効果音を停止</button>
        <div class="flex"
            style="align-items: center; border: 1px solid var(--gray-4); padding: 2px 7px; border-radius: 12px;">
            <label style="margin-inline-end: 1rem;">ダッキング</label>
            <Toggle :model-value="engine_store.ducking" @clicked="requestDucking" />
        </div>
        <button v-if="engine_store.sidecar_mode !== 'visitor'" @click="toggle_ui_mode()">{{ ui_store.ui_mode ==
            "live" ? "編集" : "完了" }}</button>
    </div>
</template>
