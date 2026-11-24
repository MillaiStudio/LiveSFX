<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
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

const store = useSideCarStore()
const config_store = useConfigStore();

const emit = defineEmits(['close'])

const page = ref(0)

const offer = ref('')
const answer = ref('')
const src = ref();

const id = ref();
const ok = ref(false)
onMounted(async () => {
    ok.value = false
    const offer_request = await ProjectManager.create_host();
    if (offer_request.some) {
        id.value = offer_request.value.id;
        offer.value = JSON.stringify(offer_request.value.offer)
        if (offer.value.length > 4200) {
            return
        }
        src.value = await QRCode.toDataURL(offer.value);
    }
    else {
        alert('ホストを作成できませんでした')
    }
})
const share = async () => {
    await navigator.share({ text: offer.value })
}

const detect = (value: string[]) => {
    answer.value = value[0] ?? '';
    show_reader.value = false;
}
const err = () => {
    show_reader.value = false;
    err_cam.value = true
}
const show_reader = ref(false)
const err_cam = ref(false);
const connecting = ref(false)
const apply = async () => {
    connecting.value = true
    const res = await ProjectManager.apply_answer(id.value, JSON.parse(answer.value))
    if (res.ok) {
        page.value++;
        ok.value = true
    } else {
        connecting.value = false;
        alert('接続できませんでした。デバイスがLAN内に存在するかを確認の上もう一度お試しください。')
    }
}
const onClick = (e: PointerEvent) => {
    if (config_store.autoSelectCredentials)
        (e.target as HTMLTextAreaElement).select()
}
onBeforeUnmount(() => {
    if (ok.value == false && id.value) ProjectManager.disconnect(id.value)
})
</script>
<template>
    <Settinglist>
        <SettingsSection title="接続情報" v-if="page == 0">
            <div class="flex"
                style="justify-content: center; align-items: center; gap:7px; padding: 12px; text-align: center; flex-direction: column;">
                <h2>接続するデバイスでQRコードを読み取る</h2>
                <img alt="QRコード" class="qr-area" v-if="offer && offer.length < 4201" :src="src">
                <div class="qr-area flex qr-dummy" v-else-if="offer">
                    <small>QRコードの作成に失敗しました</small>
                </div>
                <div class="qr-area flex qr-dummy" v-else>
                    <Spinner />
                    <small>読み込み中</small>
                </div>
                <p>または手動で共有</p>
                <textarea readonly @click="onClick" v-model="offer" :disabled="!offer" name="offer">
                </textarea>
                <button v-if="offer && SupportedShareAPI" @click="share()">共有</button>
                <p>接続するデバイスで読み込みが成功したら次へをクリックしてください。</p>
            </div>
            <SettingsRow chevron label="次へ" @click="page++" />
        </SettingsSection>
        <div v-if="page == 1" style="display: flex; flex-direction: column;">
            <SettingsSection title="説明">
                <div class="flex"
                    style="justify-content: center; align-items: center; gap:7px; padding: 12px; text-align: center; flex-direction: column;">
                    最後に接続するデバイスに表示されている文字を入力するかQRコードを読み取ってください、
                </div>
            </SettingsSection>
            <SettingsSection title="説明">
                <SettingsRow :chevron="!err_cam" :label="err_cam ? 'カメラは使用できませんでした' : 'QRコードを読み込む'"
                    @click="show_reader = true" />
                <div style="padding: 7px 16px; gap: 12px; display: flex; flex-direction: column;">
                    <div>情報を入力</div>
                    <textarea @click="onClick" v-model="answer" name="answer"></textarea>
                </div>
            </SettingsSection>
            <button style="margin: 0 16px; display: block;" :disabled="answer.length == 0 || connecting"
                @click="apply">接続を確認</button>
        </div>
        <div v-if="store.sidecar_mode && page == 2" style="text-align: center;">
            <h2>接続に成功しました</h2>
            <p>ほかのデバイスからこのLiveSFXを操作できるようになりました。</p>
            <br>
            <button @click="emit('close')">閉じる</button>
        </div>
    </Settinglist>
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
