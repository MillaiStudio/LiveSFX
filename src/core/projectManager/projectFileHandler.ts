import {
    SoundFileType,
    type BGMFile,
    type SFXFile,
} from "../audioEngine/sounds";
import { openLvsfFilePicker } from "../files/fileUtil";
import type { LVSFFile } from "../files/lvsf";
import { LogCategory, logger } from "../log/log";
import {
    Err,
    Ok,
    type lvsf_prj_info,
    type Option,
    type Result,
} from "../types/types";

const checkLVSFFile = (fileList: Option<File[]>): Result<File, string> => {
    if (!fileList.some) return Err("no file picked");
    if (!fileList.value[0]) return Err("no file picked");
    return Ok(fileList.value[0]);
};

interface fileExResult {
    sfx: SFXFile[];
    bgm: BGMFile[];
    load_failed: boolean;
}

const log = logger.module("ProjectFileHandler");

const extractSoundData = async (
    manager: LVSFFile,
    info: lvsf_prj_info,
): Promise<Result<fileExResult, string>> => {
    const start = performance.now();
    log.info(
        LogCategory.FILE,
        "ExtractSoundData",
        "extractiong sound data from lvsf",
    );
    let load_failed = false;

    const settled = await Promise.allSettled(
        info.sounds.map(async (sound_info) => {
            const blob = manager.get_sound_data(sound_info.id);
            if (!blob.ok) {
                throw blob.value;
            }
            if (sound_info.type === SoundFileType.BGM) {
                return {
                    kind: "bgm" as const,
                    sound: { ...sound_info, file: blob.value },
                };
            }
            return {
                kind: "sfx" as const,
                sound: { ...sound_info, file: await blob.value.arrayBuffer() },
            };
        }),
    );

    const sfx_frag: SFXFile[] = [];
    const bgm_frag: BGMFile[] = [];
    for (const entry of settled) {
        if (entry.status === "rejected") {
            load_failed = true;
            log.warn(
                LogCategory.FILE,
                "ExtractSoundData",
                "Failed to extract sound",
            );
            continue;
        }
        if (entry.value.kind === "bgm") bgm_frag.push(entry.value.sound);
        else sfx_frag.push(entry.value.sound);
    }
    const end = performance.now();
    log.info(LogCategory.FILE, "ExtractSoundData", "Extracted sound data", {
        data: {
            load_failed,
            time_in: end - start,
        },
    });
    return Ok({ sfx: sfx_frag, bgm: bgm_frag, load_failed });
};

interface ExtractedProjectFileData extends fileExResult {
    filename: string;
}
export const start_from_file = async (
    lvsffile?: File,
): Promise<Result<ExtractedProjectFileData | string, string>> => {
    log.info(LogCategory.FILE, "OpeningLVSF", "starting from lvsf");
    let file;
    if (lvsffile) {
        log.debug(LogCategory.FILE, "OpeningLVSF", "File handed");
        file = Ok(lvsffile);
    } else if (!file) {
        log.debug(
            LogCategory.FILE,
            "OpeningLVSF",
            "Requesting open file picker, File isn't handed",
        );
        const filelist = await openLvsfFilePicker();
        if (!filelist.some) {
            log.debug(
                LogCategory.FILE,
                "OpeningLVSFCanceled",
                "File select canceled",
            );
            return Ok("");
        }
        file = checkLVSFFile(filelist);
        if (!file.ok) {
            log.error(LogCategory.FILE, "OpeningLVSFError", "not valid lvsf");
            return Err(file.value);
        }
    }
    log.debug(LogCategory.FILE, "OpeningLVSF", "creating instance");
    const lvsf_manager = new (await import("../files/lvsf")).LVSFFile();
    log.debug(LogCategory.FILE, "OpeningLVSF", "parsing lvsf");
    const info = await lvsf_manager.parse(file.value);
    if (!info.ok) {
        log.error(LogCategory.FILE, "OpeningLVSFError", "failed to parse", {
            data: { cause: info.value },
        });
        return Err(info.value);
    }

    const result = await extractSoundData(lvsf_manager, info.value);
    if (!result.ok) {
        log.error(LogCategory.FILE, "OpeningLVSFError", "failed to parse", {
            data: { cause: result.value },
        });
        return Err(result.value);
    }
    return Ok({ ...result.value, filename: info.value.filename });
};
