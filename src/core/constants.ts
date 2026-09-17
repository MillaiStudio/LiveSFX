export const PROJECT_FILE_EX = "lvsf";
export const LVSF_MAGIC_BYTE = "lvsf";
export const HEADER_SIZE = 16;
export const AUDIO_MIME_TYPES: Record<string, string[]> = {
    mp3: ["audio/mpeg"],
    mpg: ["audio/mpeg"],
    mpeg: ["audio/mpeg"],

    m4a: ["audio/mp4", "audio/x-m4a"],
    m4b: ["audio/mp4"],
    m4p: ["audio/mp4"],
    mp4: ["audio/mp4"],

    aac: ["audio/aac"],

    wav: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],

    aif: ["audio/aiff"],
    aiff: ["audio/aiff"],
    aifc: ["audio/aiff"],

    flac: ["audio/flac", "audio/x-flac"],

    ogg: ["audio/ogg"],
    oga: ["audio/ogg"],
    opus: ["audio/ogg", "audio/opus"],

    webm: ["audio/webm"],
    weba: ["audio/webm"],

    amr: ["audio/amr"],
    caf: ["audio/x-caf", "audio/caf"],

    au: ["audio/basic"],
    snd: ["audio/basic"],

    mid: ["audio/midi", "audio/x-midi"],
    midi: ["audio/midi", "audio/x-midi"],
    kar: ["audio/midi"],

    gsm: ["audio/gsm"],

    ape: ["audio/ape"],
    wv: ["audio/wavpack"],

    "3gp": ["audio/3gpp"],
    "3gpp": ["audio/3gpp"],
    "3g2": ["audio/3gpp2"],
} as const;
export type AUDIO_MIME_TYPES = keyof typeof AUDIO_MIME_TYPES;
export const UNGROUPED = "__ungrouped__";
