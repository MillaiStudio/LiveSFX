<script setup lang="ts">
import { ref } from 'vue';
import Settinglist from '../settinglist.vue';
import SettingsRow from '../settingsRow.vue';
import SettingsSection from '../settingsSection.vue';
import { ProjectManager } from '@/core/index.ts';
import { EngineCommands } from '@/core/audioEngine/commands.ts';


const props = defineProps<{ id: string, filaname: string }>();
const emit = defineEmits(['saved'])
const filename = ref(props.filaname)
const save = async () => {
    await ProjectManager.run(EngineCommands.rename, { id: props.id, name: filename.value })
    emit('saved')
}
const deleteBGM = () => {
    const decision = confirm("プロジェクトからファイルを削除しますか？");
    if (decision) {
        ProjectManager.run(EngineCommands.discard_sound, { id: props.id });
        emit('saved')
    }
}
</script>
<template>
    <div style="display: flex; flex-direction: column; padding: 20px;">
        <Settinglist>
            <SettingsSection title="その他">
                <SettingsRow label="ファイル名"><input type="text" v-model="filename"></SettingsRow>
            </SettingsSection>
            <SettingsSection>
                <SettingsRow label="BGMを削除する" chevron danger @click="deleteBGM()" />
            </SettingsSection>
        </Settinglist>
        <button @click="save" :disabled="!filename">変更を保存</button>
    </div>
</template>
