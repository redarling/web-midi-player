import { delayAsync, buildTimer } from '../util';
import { Synthesizer } from '../synthesizer/Synthesizer';
import { Note, Track } from '../types';
import { PlayerInterface } from './playerInterface';
import { Channel } from '../synthesizer/Channel';

const MAX_WAIT_SLICE_MS = 50;
const JITTER_SAFETY_MS = 5;
const MAX_VELOCITY = 127;
const MIN_VELOCITY = 0;

enum EventType {
  START = 'start',
  STOP = 'stop'
}

interface StartEvent {
  readonly time: number;
  readonly type: EventType.START;
  readonly channelIdx: number;
  readonly name: string;
  readonly velocity: number;
}

interface StopEvent {
  readonly time: number;
  readonly type: EventType.STOP;
  readonly channelIdx: number;
}

type TimelineEvent = StartEvent | StopEvent;

function eventComparator(a: TimelineEvent, b: TimelineEvent): number {
  if (a.time !== b.time) return a.time - b.time;
  if (a.type !== b.type) return a.type === EventType.STOP ? -1 : 1;
  return a.channelIdx - b.channelIdx;
}

class MidiPlayer implements PlayerInterface {
  private readonly tracks: ReadonlyArray<Track>;
  private readonly channels: Array<Channel>;
  private readonly events: ReadonlyArray<TimelineEvent>;
  private readonly totalDurationMs: number;
  private offset = 0;
  private closedAt: number | undefined;
  private eventIndex = 0;
  private seekVersion = 0;
  private timer: (() => number) | null = null;
  private now(): number {
    return (this.timer ? this.timer() : 0) + this.offset;
  }

  constructor(channels: Array<Channel>, tracks: ReadonlyArray<Track>) {
    this.tracks = tracks;
    this.channels = channels;
    let total = 0;
    for (const track of tracks) {
      for (const note of track.notes) {
        const end = note.time + note.duration;
        if (end > total) total = end;
      }
    }
    this.totalDurationMs = total;
    this.events = this.buildEventTimeline();
  }

  private ensureTimer(): void {
    if (!this.timer) this.timer = buildTimer();
  }

  private trySetClosedAt(time: number): void {
    if (this.closedAt === undefined) this.closedAt = time;
  }

  private findEventIndex(target: number): number {
    let lo = 0, hi = this.events.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.events[mid].time < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private findLastNoteBefore(target: number, notes: ReadonlyArray<Note>) {
    let lo = 0, hi = notes.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (notes[mid].time <= target) lo = mid + 1;
      else hi = mid;
    }
    return lo - 1;
  }

  private buildEventTimeline(): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    for (const [channelIdx, track] of this.tracks.entries()) {
      for (const note of track.notes) {
        if (note.time < 0 || note.duration <= 0 || note.velocity < MIN_VELOCITY || note.velocity > MAX_VELOCITY) continue;

        events.push({
          time: note.time,
          type: EventType.START,
          channelIdx,
          name: note.name,
          velocity: note.velocity
        });

        events.push({
          time: note.time + note.duration,
          type: EventType.STOP,
          channelIdx
        });
      }
    }

    return events.sort(eventComparator);
  }

  private async waitUntil(targetTime: number, waitVersion: number): Promise<void> {
    while (true) {
      if (waitVersion !== this.seekVersion) return;
  
      const remaining = targetTime - this.now();
      if (remaining <= 0) return;
  
      const slice = remaining > MAX_WAIT_SLICE_MS + JITTER_SAFETY_MS 
        ? MAX_WAIT_SLICE_MS 
        : Math.max(1, remaining - JITTER_SAFETY_MS);
  
      await delayAsync(slice);
    }
  }   

  public getTime(): number {
    if (this.closedAt !== undefined) return this.closedAt;
    return Math.max(0, Math.round(this.now()));
  }

  public async play(): Promise<void> {
    this.ensureTimer();
    this.closedAt = undefined;
    const length = this.events.length;

    try {
      while (this.eventIndex < length) {
        const nowMs = this.now();

        while (this.eventIndex < length && this.events[this.eventIndex].time <= nowMs) {
          const e = this.events[this.eventIndex++];
          if (e.type === EventType.STOP) {
            this.channels[e.channelIdx].stopNote();
          } else {
            if (!this.channels[e.channelIdx].playNote(e.name, e.velocity)) {
              this.trySetClosedAt(this.getTime());
              return;
            }
          }
        }

        if (this.eventIndex >= length) break;

        const nextEventTime = this.events[this.eventIndex].time;
        const waitVersion = this.seekVersion;
        await this.waitUntil(nextEventTime, waitVersion);
        
      }
    } finally {
      this.eventIndex = 0;
      this.trySetClosedAt(this.getTime());
    }
  }


  public skipToTimestamp(timestamp: number): void {
    if (this.closedAt !== undefined) return;

    for (const channel of this.channels) {
      channel.stopNote();
    }

    this.ensureTimer();
    this.closedAt = undefined;

    const target = Math.max(0, Math.min(timestamp, this.totalDurationMs));
    const delta = target - this.now();
    this.offset += delta;

    this.eventIndex = (target >= this.totalDurationMs)
      ? this.events.length
      : this.findEventIndex(target);

    this.seekVersion++;

    if (this.eventIndex < this.events.length && target < this.totalDurationMs) {
      Promise.resolve().then(() => {
        if (this.closedAt !== undefined) return;
        this.restoreSustainingNotes(target);
      });
    }
  }

  private restoreSustainingNotes(target: number): void {
    for (const [channelIdx, track] of this.tracks.entries()) {
      const idx = this.findLastNoteBefore(target, track.notes);
      if (idx >= 0) {
        const note = track.notes[idx];
        if (note.time < target && target < note.time + note.duration) {
            this.channels[channelIdx].playNote(note.name, note.velocity);
        }
      }
    }
  }
}

export function player(synthesizer: Synthesizer, tracks: ReadonlyArray<Track>): PlayerInterface {
  const channels: Channel[] = [];

  if (!tracks.length || tracks.every(t => !t.notes?.length)) {
    throw new Error("Cannot create MidiPlayer: no tracks with notes");
  }

  for (const track of tracks) {
    channels.push(synthesizer.getChannel(track.instrumentName));
  }

  if (channels.length !== tracks.length) {
    throw new Error("Cannot create MidiPlayer: channels length mismatch");
  }

  return new MidiPlayer(channels, tracks);
}
