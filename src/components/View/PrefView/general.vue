<script setup lang="ts">
import Loading from '@/components/loading.vue';
import Modal from '@/components/Modal.vue';
import Settinglist from '@/components/settinglist.vue';
import SettingsRow from '@/components/settingsRow.vue';
import SettingsSection from '@/components/settingsSection.vue';
import Toggle from '@/components/toggle.vue';
import { useConfigStore } from '@/core/store/configstore.ts';
import { useUpdateStore } from '@/core/store/updatestore.ts';
import { SquareArrowOutUpRight } from '@lucide/vue';
import { defineAsyncComponent, ref } from 'vue';

const store = useConfigStore()
const updateStore = useUpdateStore()

const appVersion = __APP_VERSION__;

const showLicense = ref(false);
const showChangelog = ref(false);
const showLogView = ref(false)

const licenseView = defineAsyncComponent({
    loader: () => import('../license.vue'),
    loadingComponent: Loading
})
const changelogView = defineAsyncComponent({
    loader: () => import('../ChangelogView.vue'),
    loadingComponent: Loading
})
const logView = defineAsyncComponent({
    loader: () => import('../LogView.vue'),
    loadingComponent: Loading
})

function resetSettings() {
    const will = confirm('すべての設定を初期値に戻します。よろしいですか？')
    if (!will) return
    store.$reset()
    store.is_first = false;
}
</script>
<template>
    <div>
        <Settinglist>
            <SettingsSection title="動作" footer="iPhoneやiPad等一部の環境では再読み込み時に警告を出すことができません。">
                <SettingsRow label="編集モード繊維の遷移">
                    <Toggle v-model="store.enterEditModeConfirm" />
                </SettingsRow>
                <SettingsRow label="プロジェクト未保存時の警告">
                    <Toggle v-model="store.alertBeforeLeave" />
                </SettingsRow>
            </SettingsSection>
            <SettingsSection title="アニメーション">
                <SettingsRow label="モーダルのアニメーション">
                    <Toggle v-model="store.modalAnimation" />
                </SettingsRow>
            </SettingsSection>
            <SettingsSection title="動作">
                <SettingsRow label="ドラッグのしきい値">
                    <input type="number" min="0" step="1" v-model.number="store.dragThreshold">
                </SettingsRow>
                <SettingsRow label="カード入れ替えのしきい値">
                    <input type="number" min="0" max="1" step="0.1" v-model.number="store.swapInnerRatio">
                </SettingsRow>
                <SettingsRow label="入れ替えのクールダウン">
                    <input type="number" min="0" step="10" v-model.number="store.swapCooldownMs">
                </SettingsRow>
            </SettingsSection>
            <SettingsSection title="プライバシー">
                <SettingsRow label="エラー情報の収集に同意">
                    <Toggle v-model="store.collecting_error_info_consent" />
                </SettingsRow>
            </SettingsSection>
            <SettingsSection title="その他">
                <SettingsRow label="最後に開いていたタブの記憶">
                    <Toggle v-model="store.memoryLastTab" />
                </SettingsRow>
            </SettingsSection>
            <SettingsSection title="ログ" footer="ログの最大保持数 - メモリ上に保存されるログの最大数です。大きくしすぎるとパフォーマンス上の問題が起きることがあります。">
                <SettingsRow label="ログの最大保持数"><input type="number" v-model="store.maxLogEntries" min="1"></SettingsRow>
                <SettingsRow chevron label="ログを表示" @click="showLogView = true" />
            </SettingsSection>
            <SettingsSection title="情報">
                <div style="text-align:  center; padding: 8px;">
                    <img src="/logo.svg">
                    <h2>LiveSFX</h2>
                    <small>v{{ appVersion }}</small><br>
                    <small>This project is licensed under the ISC License</small>
                    <br>
                    <a href="https://github.com/MillaiStudio/LiveSFX" target="_blank" rel="noopener noreferrer">
                        GitHub
                        <SquareArrowOutUpRight :size="12" />
                    </a>
                    <div style="display: flex; gap:12px; justify-content: center;">
                        <a href="https://ocelot2024.folita.me/" target="_blank" rel="noopener noreferrer">folita.me
                            <SquareArrowOutUpRight :size="12" />
                        </a>
                        <a href="https://twitter.com/rigel_makao?mx=1" target="_blank" rel="noopener noreferrer">Twitter
                            <SquareArrowOutUpRight :size="12" />
                        </a>
                    </div>
                </div>
                <SettingsRow v-if="updateStore.hasPendingUpdate" :label="`アップデート (v${updateStore.newVersion?.version})`"
                    chevron @click="updateStore.showUpdateModal = true" />
                <SettingsRow v-else-if="updateStore.checking" label="確認中…" />
                <SettingsRow v-else label="アップデートを確認" chevron @click="updateStore.checkForUpdate()" />
                <SettingsRow label="更新履歴" chevron @click="showChangelog = true" />
                <SettingsRow label="ライセンス一覧" chevron @click="showLicense = true" />
            </SettingsSection>
            <SettingsSection title="リセット">
                <SettingsRow label="設定を初期値に戻す" chevron danger @click="resetSettings" />
            </SettingsSection>
        </Settinglist>
        <Modal :show="showLicense" @close="showLicense = false">
            <licenseView />
        </Modal>
        <Modal :show="showChangelog" @close="showChangelog = false" title="更新履歴">
            <changelogView />
        </Modal>
        <Modal :show="showLogView" @close="showLogView = false" :fixed_size="true">
            <logView />
        </Modal>
    </div>
</template>
