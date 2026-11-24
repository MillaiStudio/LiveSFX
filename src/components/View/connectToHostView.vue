<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Settinglist from '../settinglist.vue';
import SettingsSection from '../settingsSection.vue';
import Spinner from '../Spinner.vue';
import { ProjectManager } from '@/core/index.ts';
import QRCode from 'qrcode';
import { SupportedShareAPI } from '@/core/util/compatibility.ts';
import SettingsRow from '../settingsRow.vue';
import Modal from '../Modal.vue';
import QRreader from '../QRreader.vue';
import { useSideCarStore } from '@/core/store/sidecar_store.ts';
import { useConfigStore } from '@/core/store/configstore.ts';

const store = useSideCarStore();
const config_store = useConfigStore();

const page = ref(0)

const offer = ref('')
const answer = ref('')
const src = ref();

const emit = defineEmits(['close'])

const share = async () => {
    await navigator.share({ text: answer.value })
}

const detect = (value: string[]) => {
    offer.value = value[0] ?? '';
    show_reader.value = false;
}
const err = () => {
    show_reader.value = false;
    err_cam.value = true
}
const show_reader = ref(false)
const err_cam = ref(false);
const connecting = ref(false)
const join_host = async () => {
    try {
        connecting.value = true
        const res = await ProjectManager.join_host(JSON.parse(offer.value));
        if (res.ok) {
            answer.value = JSON.stringify(res.value);
            connecting.value = false;
            page.value++;
            src.value = await QRCode.toDataURL(answer.value);
        } else {
            alert('接続に失敗しました');
            connecting.value = false
        }
    } catch {
        alert('接続情報が不正です。')
    }
}
const onClick = (e: PointerEvent) => {
    if (config_store.autoSelectCredentials)
        (e.target as HTMLTextAreaElement).select()
}
</script>
<template>
    <Settinglist v-if="!store.sidecar_mode">
        <div v-if="page == 0" style="display: flex; flex-direction: column;">
            <SettingsSection title="説明">
                <div class="flex"
                    style="justify-content: center; align-items: center; gap:7px; padding: 12px; text-align: center; flex-direction: column;">
                    ホストのQRコードを読み取るか情報を入力してください。
                </div>
            </SettingsSection>
            <SettingsSection title="説明">
                <SettingsRow :chevron="!err_cam" :label="err_cam ? 'カメラは使用できませんでした' : 'QRコードを読み込む'"
                    @click="show_reader = true" />
                <div style="padding: 7px 16px; gap: 12px; display: flex; flex-direction: column;">
                    <div>情報を入力</div>
                    <textarea @click="onClick" v-model="offer" name="offer"></textarea>
                </div>
            </SettingsSection>
            <button style="margin: 0 16px; display: block;" :disabled="offer.length == 0 || connecting"
                @click="join_host">次へ</button>
        </div>
        <div v-if="page == 1">
            <SettingsSection title="接続の承認">
                <div class="flex"
                    style="justify-content: center; align-items: center; gap:7px; padding: 12px; text-align: center; flex-direction: column;">
                    <h2>ホストでQRコードを読み取る</h2>
                    <img alt="QRコード" class="qr-area" v-if="offer && offer.length < 4201" :src="src">
                    <div class="qr-area flex qr-dummy" v-else-if="offer">
                        <small>QRコードの作成に失敗しました</small>
                    </div>
                    <div class="qr-area flex qr-dummy" v-else>
                        <Spinner />
                        <small>読み込み中</small>
                    </div>
                    <p>または手動で共有</p>
                    <textarea @click="onClick" readonly v-model="answer" :disabled="!answer" name="answer">
                </textarea>
                    <button v-if="offer && SupportedShareAPI" @click="share()">共有</button>
                </div>
            </SettingsSection>
        </div>
    </Settinglist>
    <div v-else style="text-align: center;">
        <h2>ホストと接続を確立しました</h2>
        <p>このデバイスからホストのLiveSFXを操作することができます。</p>
        <br>
        <button @click="emit('close')">閉じる</button>
    </div>
    <Modal :show="show_reader" @close="show_reader = false">
        <h2>接続するデバイスに表示されたQRコードを読み込んでください</h2>
        <QRreader @detect="detect" @error="err()" />
    </Modal>
</template>
<style scoped>
.qr-area {
    display: block;
    width: 50%;
    border-radius: 12px;
    border: 1px solid var(--gray-5);
    aspect-ratio: 1/1;
}

.qr-dummy {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 12px;
}
</style>
