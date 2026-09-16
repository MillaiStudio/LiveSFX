import { defineStore } from "pinia";
import { ref } from "vue";
import { ProjectManager } from "..";
import { EngineEvent } from "../types/types";
import { type Notificatin } from "./enginestore_type";
import { EngineError, EngineException } from "../types/error_types";
import { generateUUID } from "../util/util";
import { AudioMixerError } from "../types/err";

export const useEngineState = defineStore("notif", () => {
    const notif_queue = ref<Notificatin[]>([]);

    ProjectManager.addEventListener(EngineEvent.Error, (e) => {
        const event = e as CustomEvent<{
            type: EngineError | EngineException | string;
        }>;
        const id = generateUUID();
        const type = event.detail.type;

        const message =
            type in messages
                ? messages[type as EngineError | EngineException]
                : type;

        const restart = async () => {
            await ProjectManager.export();
            location.reload();
        };
        const onClick = type == "panic" ? restart : () => dismissNotif(id);
        notif_queue.value.push({
            id,
            type: "critical",
            title: "エラーが発生しました",
            message: message,
            onClick,
        });
        setTimeout(() => {
            const index = notif_queue.value.findIndex((v) => id === v.id);

            if (index !== -1) {
                notif_queue.value.splice(index, 1);
            }
        }, 1000);
    });

    const dismissNotif = (id: string) => {
        const index = notif_queue.value.findIndex((v) => id === v.id);
        if (index !== -1) {
            notif_queue.value.splice(index, 1);
        }
    };

    return {
        dismissNotif,
    };
});

type ErrMsgType = {
    [K in EngineError | EngineException | AudioMixerError]: string;
};

const messages: ErrMsgType = {
    [EngineException.DBSaveCacheError]:
        "データベースにキャッシュを書き込めませんでした",
    [EngineError.NoProjectFile]: "処理するプロジェクトファイルがありません。",
    [EngineError.InvalidLVSFFile]: "LVSFファイルが壊れています",
    [EngineError.SoundNotExist]: "音源が見つかりませんでした",
    [EngineError.CouldNotCleanUpDB]:
        "データベースをクリーンアップできませんでした",
    [EngineException.InitialiseDBException]:
        "データベースを初期化できませんでした",
    [EngineException.NoSoundData]: "音源が見つかりませんでした",
    [EngineError.GroupAlreadyExist]: "そのグループは既に存在します",
    [EngineError.GroupNotFound]: "グループが見つかりませんでした",
    [EngineError.ChannelNotFound]: "チャンネルが見つかりませんでした",
    [EngineError.StorageNotReady]: "キャッシュストレージが初期化されていません",
    [EngineError.PartialSoundLoadFailed]:
        "一部の音声のキャッシュ読み込みに失敗しました。",
    [EngineError.PartialSoundAddFailed]:
        "一部の音声キャッシュの保存に失敗しました",
    [EngineError.MissingCachedAudioForExport]:
        "エクスポートするのに必要なキャッシュが欠損しています。",
    [EngineError.UnknownSound]: "未知のサウンドが追加されました",
    [EngineException.Panic]:
        "予想外のエラーが発生しました。この通知をクリックしてプロジェクトを保存し再起動できます。",
    [AudioMixerError.ChannelNotFound]: "チャンネルが見つかりません",
};
