import { UNGROUPED } from "../constants";
import { AudioMixerError } from "../types/err";
import { EngineError } from "../types/error_types";
import { Err, Ok, type Result } from "../types/types";
import { generateUUID } from "../util/util";

export const MIXER_MASTER_CHANNEL_ID = "MASTER";

interface MixerEntry {
    channel: Channel;
    belongs_to: string;
    isGroup: boolean;
}

export interface MixerChannelSnapshot {
    id: string;
    name: string;
    belongs_to: string;
    isGroup: boolean;
    gain: number;
}

export class Channel {
    readonly inputGain: GainNode;
    readonly output: GainNode;
    name: string;
    id?: string;
    constructor(ctx: AudioContext, name: string, id?: string) {
        this.inputGain = ctx.createGain();
        this.output = ctx.createGain();
        // Leave room for future effects.
        this.inputGain.connect(this.output);
        this.name = name;
        this.id = id;
    }
}

export class AudioMixer {
    private ctx: AudioContext;
    private entries: Record<string, MixerEntry>;

    constructor(ctx: AudioContext) {
        this.ctx = ctx;
        this.entries = {};
        const master = new Channel(ctx, "MASTER", MIXER_MASTER_CHANNEL_ID);
        master.output.connect(ctx.destination);
        this.entries[MIXER_MASTER_CHANNEL_ID] = {
            channel: master,
            belongs_to: "",
            isGroup: true,
        };
        this.createGroup(UNGROUPED);
    }

    private get master(): Channel {
        return this.entries[MIXER_MASTER_CHANNEL_ID]!.channel;
    }

    createGroup(name: string): Result<string, string> {
        if (name in this.entries) return Err(EngineError.GroupAlreadyExist);
        const channel = new Channel(this.ctx, name, name);
        channel.output.connect(this.master.inputGain);
        this.entries[name] = {
            channel,
            belongs_to: MIXER_MASTER_CHANNEL_ID,
            isGroup: true,
        };
        return Ok(name);
    }

    create_channel(
        id: string,
        name: string,
        parent?: string,
    ): Result<string, string> {
        if (id in this.entries) {
            return this.create_channel(generateUUID(), name, parent);
        }

        const parentId = parent ?? MIXER_MASTER_CHANNEL_ID;
        let parentEntry = this.entries[parentId];
        if (!parentEntry || !parentEntry.isGroup) {
            if (parentId === MIXER_MASTER_CHANNEL_ID) {
                return Err(EngineError.GroupNotFound);
            }
            const created = this.createGroup(parentId);
            if (!created.ok) return Err(EngineError.GroupNotFound);
            parentEntry = this.entries[parentId];
        }
        if (!parentEntry) return Err(EngineError.GroupNotFound);

        const channel = new Channel(this.ctx, name, id);
        channel.output.connect(parentEntry.channel.inputGain);
        this.entries[id] = { channel, belongs_to: parentId, isGroup: false };
        return Ok(id);
    }

    channel_finder(
        id: string,
    ): { belongs_to: string; channel: Channel } | null {
        const entry = this.entries[id];
        if (!entry) return null;
        return { belongs_to: entry.belongs_to, channel: entry.channel };
    }

    group_children(parent: string): Channel[] {
        return Object.values(this.entries)
            .filter((e) => !e.isGroup && e.belongs_to === parent)
            .map((e) => e.channel);
    }

    get_group_names(): string[] {
        return Object.entries(this.entries)
            .filter(([id, e]) => e.isGroup && id !== MIXER_MASTER_CHANNEL_ID)
            .map(([id]) => id);
    }

    get_all_channels(): MixerChannelSnapshot[] {
        return Object.entries(this.entries).map(([id, entry]) => ({
            id,
            name: entry.channel.name,
            belongs_to: entry.belongs_to,
            isGroup: entry.isGroup,
            gain: entry.channel.output.gain.value,
        }));
    }

    delete_channel(id: string): Result<void, string> {
        const entry = this.entries[id];
        if (!entry) return Err(EngineError.ChannelNotFound);
        entry.channel.inputGain.disconnect();
        entry.channel.output.disconnect();
        delete this.entries[id];
        return Ok();
    }

    move_channel(id: string, newGroup?: string): Result<void, string> {
        const entry = this.entries[id];
        if (!entry || entry.isGroup) {
            return Err(EngineError.ChannelNotFound);
        }

        const target = newGroup ?? MIXER_MASTER_CHANNEL_ID;
        if (entry.belongs_to === target) {
            return Ok();
        }

        let parent = this.entries[target];

        if (!parent || !parent.isGroup) {
            const created = this.createGroup(target);
            if (!created.ok) {
                return Err(EngineError.GroupNotFound);
            }
            parent = this.entries[target];
        }
        if (!parent) return Err(EngineError.GroupNotFound);

        entry.channel.output.disconnect();
        entry.channel.output.connect(parent.channel.inputGain);

        entry.belongs_to = target;

        return Ok();
    }

    rename_group(oldName: string, newName: string): Result<void, string> {
        if (oldName === MIXER_MASTER_CHANNEL_ID) {
            return Err(EngineError.GroupNotFound);
        }
        const entry = this.entries[oldName];
        if (!entry || !entry.isGroup) return Err(EngineError.GroupNotFound);
        if (newName in this.entries) return Err(EngineError.GroupAlreadyExist);

        entry.channel.name = newName;
        entry.channel.id = newName;
        delete this.entries[oldName];
        this.entries[newName] = entry;

        for (const e of Object.values(this.entries)) {
            if (e.belongs_to === oldName) e.belongs_to = newName;
        }
        return Ok();
    }

    delete_group(name: string): Result<void, string> {
        const entry = this.entries[name];
        if (!entry || !entry.isGroup || name === MIXER_MASTER_CHANNEL_ID) {
            return Err(EngineError.GroupNotFound);
        }

        for (const [id, e] of Object.entries(this.entries)) {
            if (e.belongs_to === name) this.move_channel(id);
        }

        entry.channel.inputGain.disconnect();
        entry.channel.output.disconnect();
        delete this.entries[name];
        return Ok();
    }

    input(id: string, source: AudioNode): Result<void, string> {
        const entry = this.entries[id];
        if (!entry) return Err(EngineError.ChannelNotFound);
        source.connect(entry.channel.inputGain);
        return Ok();
    }

    set_gain(
        id: string,
        gain: number,
        time?: number,
    ): Result<number, AudioMixerError> {
        const entry = this.entries[id];
        if (!entry) return Err(AudioMixerError.ChannelNotFound);
        entry.channel.output.gain.setTargetAtTime(gain, 0, time ?? 0.01);
        return Ok(gain);
    }

    get_gain(id: string): Result<number, AudioMixerError> {
        const entry = this.entries[id];
        if (!entry) return Err(AudioMixerError.ChannelNotFound);
        return Ok(entry.channel.output.gain.value);
    }

    connect_media_elem(
        element: HTMLMediaElement,
        deckId: "deckA" | "deckB",
    ): Result<void, string> {
        const sourceNode = new MediaElementAudioSourceNode(this.ctx, {
            mediaElement: element,
        });

        const created = this.create_channel(deckId, deckId, "BGM");
        if (!created.ok) return Err(created.value);

        const entry = this.entries[deckId];
        if (!entry) return Err(EngineError.ChannelNotFound);

        sourceNode.connect(entry.channel.inputGain);
        return Ok();
    }
}
