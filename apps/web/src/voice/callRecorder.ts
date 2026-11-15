import { sharedAudioContext } from './sharedAudio';
import { voiceOutputBus } from './tts';

const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

const saveRecording = (blob: Blob, startedAt: number) => {
  if (blob.size === 0) return;
  const stamp = new Date(startedAt).toISOString().slice(0, 19).replace(/:/g, '-').replace('T', '_');
  const ext = blob.type.includes('mp4') ? 'm4a' : 'webm';
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pico-call-${stamp}.${ext}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

// Records the user's mic and AI speech into one file. AI audio is captured only
// when it plays through the Web Audio chain; the speechSynthesis fallback is not.
export class CallRecorder {
  private recorder: MediaRecorder | null = null;
  private routing: { mic: MediaStreamAudioSourceNode; bus: AudioNode; dest: AudioNode } | null = null;

  start(mic: MediaStream): boolean {
    const ctx = sharedAudioContext();
    if (!ctx || this.recorder || typeof MediaRecorder === 'undefined') return false;
    const bus = voiceOutputBus(ctx);
    const dest = ctx.createMediaStreamDestination();
    const micSource = ctx.createMediaStreamSource(mic);
    micSource.connect(dest);
    bus.connect(dest);
    this.routing = { mic: micSource, bus, dest };

    const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(
      (dest as MediaStreamAudioDestinationNode).stream,
      mimeType ? { mimeType } : undefined,
    );
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => saveRecording(new Blob(chunks, { type: recorder.mimeType }), startedAt);
    recorder.start(1000);
    this.recorder = recorder;
    return true;
  }

  stop() {
    const recorder = this.recorder;
    if (!recorder) return;
    this.recorder = null;
    if (recorder.state !== 'inactive') recorder.stop();
    if (this.routing) {
      this.routing.mic.disconnect();
      this.routing.bus.disconnect(this.routing.dest);
      this.routing = null;
    }
  }
}
